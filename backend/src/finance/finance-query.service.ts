import { BadRequestException, Injectable, StreamableFile } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { ListInvoicesDto } from "./dto/list-invoices.dto";
import {
  clientScope,
  csvCell,
  invoiceSelect,
  isSettledInvoice,
  presentInvoice,
  settledInvoiceStatuses,
} from "./finance.shared";

@Injectable()
export class FinanceQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: Actor) {
    const now = new Date();
    const baseWhere = { tenantId: actor.tenantId, ...clientScope(actor) };
    const openWhere = {
      ...baseWhere,
      status: { notIn: [...settledInvoiceStatuses] },
    };
    const day = 86_400_000;
    const boundary = (days: number) => new Date(now.getTime() - days * day);
    const ageingBuckets = [
      { label: "0–30 days", dueAt: { gt: boundary(31), lte: now } },
      { label: "31–60 days", dueAt: { gt: boundary(61), lte: boundary(31) } },
      { label: "61–90 days", dueAt: { gt: boundary(91), lte: boundary(61) } },
      { label: "90+ days", dueAt: { lte: boundary(91) } },
    ] as const;
    const [all, active, openCount, overdue, ageingTotals] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: baseWhere,
        _count: { _all: true },
        _sum: { paidAmount: true, creditedAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, status: { not: "CANCELLED" } },
        _sum: { totalAmount: true, paidAmount: true, creditedAmount: true },
      }),
      this.prisma.invoice.count({ where: openWhere }),
      this.prisma.invoice.aggregate({
        where: { ...openWhere, dueAt: { lt: now } },
        _count: { _all: true },
        _sum: { totalAmount: true, paidAmount: true, creditedAmount: true },
      }),
      Promise.all(
        ageingBuckets.map((bucket) =>
          this.prisma.invoice.aggregate({
            where: { ...openWhere, dueAt: bucket.dueAt },
            _sum: { totalAmount: true, paidAmount: true, creditedAmount: true },
          }),
        ),
      ),
    ]);
    const balance = (totals: {
      totalAmount?: unknown;
      paidAmount?: unknown;
      creditedAmount?: unknown;
    }) =>
      Number(totals.totalAmount ?? 0) -
      Number(totals.paidAmount ?? 0) -
      Number(totals.creditedAmount ?? 0);
    const ageing = ageingBuckets.map((bucket, index) => ({
      label: bucket.label,
      value: balance(ageingTotals[index]!._sum),
    }));

    return {
      summary: {
        invoiceCount: all._count._all,
        openInvoiceCount: openCount,
        billed: Number(active._sum.totalAmount ?? 0),
        collected: Number(all._sum.paidAmount ?? 0),
        credited: Number(all._sum.creditedAmount ?? 0),
        outstanding: balance(active._sum),
        overdueAmount: balance(overdue._sum),
        overdueCount: overdue._count._all,
      },
      ageing,
      generatedAt: now,
    };
  }

  async list(actor: Actor, query: ListInvoicesDto) {
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: this.buildWhere(actor, query, now),
      select: invoiceSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map((row) => presentInvoice(row, now)),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
    };
  }

  async exportLedger(actor: Actor, query: ListInvoicesDto) {
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: this.buildWhere(actor, query, now),
      select: {
        invoiceNumber: true,
        status: true,
        currency: true,
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
        paidAmount: true,
        creditedAmount: true,
        issuedAt: true,
        dueAt: true,
        createdAt: true,
        client: { select: { code: true, displayName: true } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 10_001,
    });
    if (rows.length > 10_000) {
      throw new BadRequestException(
        "This export contains more than 10,000 invoices; narrow the filters and try again",
      );
    }
    const csv = [
      [
        "Invoice",
        "Client code",
        "Client",
        "Status",
        "Currency",
        "Subtotal",
        "Tax",
        "Gross total",
        "Paid",
        "Credited",
        "Balance",
        "Issued",
        "Due",
      ],
      ...rows.map((row) => [
        row.invoiceNumber,
        row.client.code,
        row.client.displayName,
        !isSettledInvoice(row.status) && row.dueAt && row.dueAt < now
          ? "OVERDUE"
          : row.status,
        row.currency,
        Number(row.subtotal),
        Number(row.taxAmount),
        Number(row.totalAmount),
        Number(row.paidAmount),
        Number(row.creditedAmount),
        Number(row.totalAmount) -
          Number(row.paidAmount) -
          Number(row.creditedAmount),
        row.issuedAt?.toISOString().slice(0, 10) ?? "",
        row.dueAt?.toISOString().slice(0, 10) ?? "",
      ]),
    ]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "finance.ledger.exported",
        resourceType: "invoice-ledger",
        afterJson: JSON.stringify({
          count: rows.length,
          status: query.status ?? null,
        }),
      },
    });
    return new StreamableFile(Buffer.from(`\uFEFF${csv}`, "utf8"), {
      type: "text/csv; charset=utf-8",
      disposition: `attachment; filename="sapling-global-ledger-${now.toISOString().slice(0, 10)}.csv"`,
    });
  }

  private buildWhere(actor: Actor, query: ListInvoicesDto, now: Date) {
    const search = query.search?.trim();
    return {
      tenantId: actor.tenantId,
      ...clientScope(actor),
      ...(query.status && query.status !== "OVERDUE"
        ? { status: query.status }
        : {}),
      ...(query.status === "OVERDUE"
        ? {
            status: { notIn: [...settledInvoiceStatuses] },
            dueAt: { lt: now },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search } },
              { client: { displayName: { contains: search } } },
            ],
          }
        : {}),
    };
  }
}
