import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateInvoiceDto } from "./dto/create-invoice.dto";
import type { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import type { ListInvoicesDto } from "./dto/list-invoices.dto";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import { InvoicePdfService } from "./invoice-pdf.service";

const invoiceSelect = {
  publicId: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { publicId: true, displayName: true, code: true } },
  lines: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      lineTotal: true,
      case: { select: { publicId: true, caseNumber: true } },
    },
  },
  payments: {
    select: {
      publicId: true,
      amount: true,
      method: true,
      reference: true,
      receivedAt: true,
      createdAt: true,
    },
    orderBy: { receivedAt: "desc" as const },
  },
} as const;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  async overview(actor: Actor) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId: actor.tenantId },
      select: {
        status: true,
        totalAmount: true,
        paidAmount: true,
        dueAt: true,
        issuedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });
    const now = new Date();
    const outstanding = invoices
      .filter((item) => item.status !== "CANCELLED")
      .reduce(
        (sum, item) => sum + Number(item.totalAmount) - Number(item.paidAmount),
        0,
      );
    const overdue = invoices.filter(
      (item) =>
        item.status !== "PAID" &&
        item.status !== "CANCELLED" &&
        item.dueAt &&
        item.dueAt < now,
    );
    const billed = invoices
      .filter((item) => item.status !== "CANCELLED")
      .reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const collected = invoices.reduce(
      (sum, item) => sum + Number(item.paidAmount),
      0,
    );
    const ageing = [
      { label: "0–30 days", min: 0, max: 30 },
      { label: "31–60 days", min: 31, max: 60 },
      { label: "61–90 days", min: 61, max: 90 },
      { label: "90+ days", min: 91, max: Number.POSITIVE_INFINITY },
    ].map(({ label, min, max }) => ({
      label,
      value: invoices
        .filter((item) => {
          if (["PAID", "CANCELLED"].includes(item.status) || !item.dueAt)
            return false;
          const days = Math.max(
            0,
            Math.floor((now.getTime() - item.dueAt.getTime()) / 86_400_000),
          );
          return days >= min && days <= max;
        })
        .reduce(
          (sum, item) =>
            sum + Number(item.totalAmount) - Number(item.paidAmount),
          0,
        ),
    }));
    return {
      summary: {
        invoiceCount: invoices.length,
        openInvoiceCount: invoices.filter(
          (item) => !["PAID", "CANCELLED"].includes(item.status),
        ).length,
        billed,
        collected,
        outstanding,
        overdueAmount: overdue.reduce(
          (sum, item) =>
            sum + Number(item.totalAmount) - Number(item.paidAmount),
          0,
        ),
        overdueCount: overdue.length,
      },
      ageing,
      generatedAt: now,
    };
  }

  async list(actor: Actor, query: ListInvoicesDto) {
    const search = query.search?.trim();
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.status && query.status !== "OVERDUE"
          ? { status: query.status }
          : {}),
        ...(query.status === "OVERDUE"
          ? { status: { notIn: ["PAID", "CANCELLED"] }, dueAt: { lt: now } }
          : {}),
        ...(search
          ? {
              OR: [
                { invoiceNumber: { contains: search } },
                { client: { displayName: { contains: search } } },
              ],
            }
          : {}),
      },
      select: invoiceSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((row) => this.present(row, now)),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
    };
  }

  async create(actor: Actor, input: CreateInvoiceDto) {
    if (!input.lines.length)
      throw new BadRequestException("At least one invoice line is required");
    const client = await this.prisma.client.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.clientId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!client) throw new NotFoundException("Active client not found");
    const casePublicIds = input.lines.flatMap((line) =>
      line.caseId ? [line.caseId] : [],
    );
    const cases = casePublicIds.length
      ? await this.prisma.verificationCase.findMany({
          where: {
            tenantId: actor.tenantId,
            clientId: client.id,
            publicId: { in: casePublicIds },
          },
          select: { id: true, publicId: true },
        })
      : [];
    if (cases.length !== new Set(casePublicIds).size)
      throw new NotFoundException(
        "One or more billed cases do not belong to this client",
      );
    const caseIds = new Map(cases.map((item) => [item.publicId, item.id]));
    const lines = input.lines.map((line) => {
      const unitCents = Math.round(line.unitPrice * 100);
      const baseCents = unitCents * line.quantity;
      const taxCents = Math.round(baseCents * (line.taxRate / 100));
      return {
        caseId: line.caseId ? caseIds.get(line.caseId) : undefined,
        description: line.description.trim(),
        quantity: line.quantity,
        unitPrice: unitCents / 100,
        taxRate: line.taxRate,
        baseCents,
        taxCents,
        lineTotal: (baseCents + taxCents) / 100,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.baseCents, 0) / 100;
    const taxAmount = lines.reduce((sum, line) => sum + line.taxCents, 0) / 100;
    const invoiceNumber = `SG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.invoice.create({
        data: {
          tenantId: actor.tenantId,
          clientId: client.id,
          invoiceNumber,
          status: "ISSUED",
          issuedAt: new Date(),
          dueAt: new Date(input.dueAt),
          subtotal,
          taxAmount,
          totalAmount: subtotal + taxAmount,
          notes: input.notes?.trim(),
          lines: {
            create: lines.map((line) => ({
              caseId: line.caseId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              taxRate: line.taxRate,
              lineTotal: line.lineTotal,
            })),
          },
        },
        select: invoiceSelect,
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "finance.invoice.issued",
          resourceType: "invoice",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            invoiceNumber,
            totalAmount: subtotal + taxAmount,
          }),
        },
      });
      return this.present(row, new Date());
    });
  }

  async downloadInvoice(actor: Actor, publicId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: {
        invoiceNumber: true,
        status: true,
        currency: true,
        issuedAt: true,
        dueAt: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        paidAmount: true,
        notes: true,
        createdAt: true,
        client: {
          select: {
            legalName: true,
            displayName: true,
            code: true,
            billingTerms: true,
          },
        },
        lines: {
          select: {
            description: true,
            quantity: true,
            unitPrice: true,
            taxRate: true,
            lineTotal: true,
            case: { select: { caseNumber: true } },
          },
          orderBy: { id: "asc" },
        },
        payments: {
          select: { amount: true, method: true, receivedAt: true },
          orderBy: { receivedAt: "asc" },
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");

    const contents = await this.invoicePdf.render({
      ...invoice,
      status:
        !["PAID", "CANCELLED"].includes(invoice.status) &&
        invoice.dueAt &&
        invoice.dueAt < new Date()
          ? "OVERDUE"
          : invoice.status,
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "finance.invoice.downloaded",
        resourceType: "invoice",
        resourcePublicId: publicId,
        afterJson: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
      },
    });
    return new StreamableFile(contents, {
      type: "application/pdf",
      disposition: `attachment; filename="Sapling-Global-${invoice.invoiceNumber}.pdf"`,
    });
  }

  async recordPayment(actor: Actor, publicId: string, input: RecordPaymentDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        version: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.version !== input.version)
      throw new ConflictException("Invoice changed; refresh and try again");
    if (["PAID", "CANCELLED"].includes(invoice.status))
      throw new ConflictException(
        `Payment cannot be recorded against a ${invoice.status.toLowerCase()} invoice`,
      );
    const nextPaid =
      Math.round((Number(invoice.paidAmount) + input.amount) * 100) / 100;
    if (nextPaid > Number(invoice.totalAmount))
      throw new BadRequestException("Payment exceeds the invoice balance");
    const nextStatus =
      nextPaid === Number(invoice.totalAmount) ? "PAID" : "PARTIALLY_PAID";
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.updateMany({
        where: { id: invoice.id, version: input.version },
        data: {
          paidAmount: nextPaid,
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Invoice was updated concurrently");
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
      return {
        id: payment.publicId,
        amount: payment.amount,
        method: payment.method,
        receivedAt: payment.receivedAt,
        invoiceStatus: nextStatus,
        invoiceVersion: input.version + 1,
        paidAmount: nextPaid,
      };
    });
  }

  async cancelInvoice(actor: Actor, publicId: string, input: CancelInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { tenantId: actor.tenantId, publicId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        paidAmount: true,
        version: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.version !== input.version)
      throw new ConflictException("Invoice changed; refresh and try again");
    if (invoice.status === "CANCELLED")
      return { id: publicId, status: "CANCELLED", version: invoice.version };
    if (invoice.status === "PAID" || Number(invoice.paidAmount) > 0) {
      throw new ConflictException(
        "An invoice with recorded payments cannot be cancelled; reconcile it with a credit entry",
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
      if (updated.count !== 1)
        throw new ConflictException("Invoice was updated concurrently");
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

  private present<
    T extends { publicId: string; status: string; dueAt: Date | null },
  >(row: T, now: Date) {
    const { publicId, ...invoice } = row;
    const status =
      !["PAID", "CANCELLED"].includes(invoice.status) &&
      invoice.dueAt &&
      invoice.dueAt < now
        ? "OVERDUE"
        : invoice.status;
    return { id: publicId, ...invoice, status };
  }
}
