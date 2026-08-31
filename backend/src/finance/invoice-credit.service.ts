import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateCreditNoteDto } from "./dto/create-credit-note.dto";
import {
  clientScope,
  fromPaise,
  isSettledInvoice,
  toPaise,
} from "./finance.shared";

@Injectable()
export class InvoiceCreditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: Actor, publicId: string, input: CreateCreditNoteDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        id: true,
        invoiceNumber: true,
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
        `A credit note cannot be added to a ${invoice.status.toLowerCase()} invoice`,
      );
    }

    const nextCreditPaise =
      toPaise(invoice.creditedAmount) + toPaise(input.amount);
    const paidPaise = toPaise(invoice.paidAmount);
    const totalPaise = toPaise(invoice.totalAmount);
    if (nextCreditPaise + paidPaise > totalPaise) {
      throw new BadRequestException("Credit note exceeds the invoice balance");
    }
    const nextCredit = fromPaise(nextCreditPaise);
    const nextStatus = creditStatus(nextCreditPaise, paidPaise, totalPaise);
    const noteNumber = `CN-${dateToken()}-${randomToken()}`;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, version: input.version },
        data: {
          creditedAmount: nextCredit,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Invoice was updated concurrently");
      }
      const credit = await tx.creditNote.create({
        data: {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
          createdById: actor.userId,
          noteNumber,
          amount: input.amount,
          reason: input.reason.trim(),
        },
        select: {
          publicId: true,
          noteNumber: true,
          amount: true,
          reason: true,
          createdAt: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "finance.credit-note.created",
          resourceType: "invoice",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            status: invoice.status,
            creditedAmount: Number(invoice.creditedAmount),
          }),
          afterJson: JSON.stringify({
            noteNumber,
            amount: input.amount,
            status: nextStatus,
            creditedAmount: nextCredit,
          }),
        },
      });
      return {
        id: credit.publicId,
        noteNumber: credit.noteNumber,
        amount: credit.amount,
        reason: credit.reason,
        createdAt: credit.createdAt,
        invoiceStatus: nextStatus,
        invoiceVersion: input.version + 1,
        creditedAmount: nextCredit,
      };
    });
  }
}

function creditStatus(credited: number, paid: number, total: number) {
  if (credited + paid !== total) return "PARTIALLY_CREDITED";
  return paid > 0 ? "SETTLED" : "CREDITED";
}

function dateToken() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function randomToken() {
  return randomBytes(3).toString("hex").toUpperCase();
}
