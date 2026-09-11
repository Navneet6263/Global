import { Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { ListInvoicesDto } from "./dto/list-invoices.dto";
import { FinanceQueryService } from "./finance-query.service";
import { InvoicePdfService } from "./invoice-pdf.service";
import { isSettledInvoice, settledInvoiceStatuses } from "./finance.shared";
import { requireClientFinanceScope } from "./client-finance.scope";

@Injectable()
export class ClientFinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queries: FinanceQueryService,
    private readonly pdf: InvoicePdfService,
  ) {}

  overview(actor: Actor) {
    requireClientFinanceScope(actor);
    return this.queries.overview(actor);
  }

  async list(actor: Actor, query: ListInvoicesDto) {
    const scope = requireClientFinanceScope(actor);
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: {
        ...scope,
        ...(query.search
          ? { invoiceNumber: { contains: query.search.trim() } }
          : {}),
        ...(query.status === "OVERDUE"
          ? {
              status: { notIn: [...settledInvoiceStatuses] },
              dueAt: { lt: now },
            }
          : query.status
            ? { status: query.status }
            : {}),
      },
      select: clientInvoiceSelect,
      orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const more = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
        status:
          !isSettledInvoice(row.status) && row.dueAt && row.dueAt < now
            ? "OVERDUE"
            : row.status,
        balance: Math.max(
          0,
          Number(row.totalAmount) -
            Number(row.paidAmount) -
            Number(row.creditedAmount),
        ),
      })),
      nextCursor: more ? page.at(-1)?.publicId : null,
    };
  }

  async download(actor: Actor, publicId: string) {
    const scope = requireClientFinanceScope(actor);
    const invoice = await this.prisma.invoice.findFirst({
      where: { ...scope, publicId },
      select: {
        ...clientInvoiceSelect,
        subtotal: true,
        taxAmount: true,
        client: {
          select: {
            code: true,
            legalName: true,
            displayName: true,
            billingTerms: true,
            billingAddress: true,
            gstin: true,
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
        },
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    const bytes = await this.pdf.render({
      ...invoice,
      status:
        !isSettledInvoice(invoice.status) &&
        invoice.dueAt &&
        invoice.dueAt < new Date()
          ? "OVERDUE"
          : invoice.status,
      notes: null,
      payments: [],
      creditNotes: [],
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "finance.client-invoice.downloaded",
        resourceType: "invoice",
        resourcePublicId: publicId,
      },
    });
    return new StreamableFile(bytes, {
      type: "application/pdf",
      disposition: `attachment; filename="Sapling-${invoice.invoiceNumber}.pdf"`,
    });
  }
}

const clientInvoiceSelect = {
  publicId: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  createdAt: true,
  totalAmount: true,
  paidAmount: true,
  creditedAmount: true,
} as const;
