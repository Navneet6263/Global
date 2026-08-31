import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import { clientScope, isSettledInvoice } from "./finance.shared";

@Injectable()
export class InvoiceCancellationService {
  constructor(private readonly prisma: PrismaService) {}

  async cancel(actor: Actor, publicId: string, input: CancelInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        paidAmount: true,
        creditedAmount: true,
        version: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.version !== input.version) {
      throw new ConflictException("Invoice changed; refresh and try again");
    }
    if (invoice.status === "CANCELLED") {
      return { id: publicId, status: "CANCELLED", version: invoice.version };
    }
    if (
      isSettledInvoice(invoice.status) ||
      Number(invoice.paidAmount) > 0 ||
      Number(invoice.creditedAmount) > 0
    ) {
      throw new ConflictException(
        "An invoice with financial entries cannot be cancelled; reconcile the remaining balance instead",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: {
          id: invoice.id,
          version: input.version,
          status: { not: "CANCELLED" },
        },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Invoice was updated concurrently");
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "finance.invoice.cancelled",
          resourceType: "invoice",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({ status: invoice.status }),
          afterJson: JSON.stringify({
            status: "CANCELLED",
            reason: input.reason.trim(),
            version: input.version + 1,
          }),
        },
      });
      return { id: publicId, status: "CANCELLED", version: input.version + 1 };
    });
  }
}
