import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import { releaseInvoiceReports } from "../reports/report-release";
import {
  clientScope,
  fromPaise,
  isSettledInvoice,
  toPaise,
} from "./finance.shared";

@Injectable()
export class InvoicePaymentService {
  constructor(private readonly prisma: PrismaService) {}

  async record(actor: Actor, publicId: string, input: RecordPaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        creditedAmount: true,
        version: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.version !== input.version) {
      throw new ConflictException("Invoice changed; refresh and try again");
    }
    if (isSettledInvoice(invoice.status)) {
      throw new ConflictException(
        `Payment cannot be recorded against a ${invoice.status.toLowerCase()} invoice`,
      );
    }

    const nextPaidPaise = toPaise(invoice.paidAmount) + toPaise(input.amount);
    const creditedPaise = toPaise(invoice.creditedAmount);
    const totalPaise = toPaise(invoice.totalAmount);
    if (nextPaidPaise + creditedPaise > totalPaise) {
      throw new BadRequestException("Payment exceeds the invoice balance");
    }
    const nextPaid = fromPaise(nextPaidPaise);
    const nextStatus = paymentStatus(nextPaidPaise, creditedPaise, totalPaise);

    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.invoice.updateMany({
          where: { id: invoice.id, version: input.version },
          data: {
            paidAmount: nextPaid,
            status: nextStatus,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException("Invoice was updated concurrently");
        }
        const payment = await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            recordedById: actor.userId,
            amount: input.amount,
            method: input.method,
            reference: input.reference?.trim(),
            receivedAt: new Date(input.receivedAt),
          },
          select: {
            publicId: true,
            amount: true,
            method: true,
            receivedAt: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "finance.payment.recorded",
            resourceType: "invoice",
            resourcePublicId: publicId,
            afterJson: JSON.stringify({
              paymentId: payment.publicId,
              amount: input.amount,
              status: nextStatus,
            }),
          },
        });
        if (nextStatus === "PAID") {
          await releaseInvoiceReports(
            tx,
            actor.tenantId,
            invoice.id,
            actor.userId,
          );
        }
        return {
          id: payment.publicId,
          amount: payment.amount,
          method: payment.method,
          receivedAt: payment.receivedAt,
          invoiceStatus: nextStatus,
          invoiceVersion: input.version + 1,
          paidAmount: nextPaid,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
}

function paymentStatus(paid: number, credited: number, total: number) {
  if (paid + credited !== total) return "PARTIALLY_PAID";
  return credited > 0 ? "SETTLED" : "PAID";
}
