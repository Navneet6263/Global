import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { SpocClientQueryDto } from "./dto/spoc-query.dto";
import {
  settledInvoiceStatuses,
  statusesHeldBy,
  terminalCaseStatuses,
} from "./spoc-holder";
import { pageResult, paging, resolveSpocClients } from "./spoc-scope";

function tally<T>(
  rows: T[],
  key: (row: T) => string,
  value: (row: T) => number = () => 1,
) {
  const totals = new Map<string, number>();
  rows.forEach((row) =>
    totals.set(key(row), (totals.get(key(row)) ?? 0) + value(row)),
  );
  return totals;
}

@Injectable()
export class SpocClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-client monitoring roll-up; one page of clients, aggregates fetched in bulk. */
  async list(actor: Actor, query: SpocClientQueryDto) {
    const now = new Date();
    const text = query.search?.trim();
    const where = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...resolveSpocClients(actor, query.clientId).clientRow,
      ...(text
        ? {
            OR: [
              { displayName: { contains: text } },
              { code: { contains: text } },
            ],
          }
        : {}),
    };
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        select: {
          id: true,
          publicId: true,
          code: true,
          displayName: true,
          status: true,
          creditHold: true,
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        ...paging(query.page, query.pageSize),
      }),
      this.prisma.client.count({ where }),
    ]);
    const ids = clients.map((client) => client.id);
    const clientHeld = statusesHeldBy("CLIENT_ADMIN");
    const [statuses, overdue, clarifications, invoices, handoffs] =
      await Promise.all([
        this.prisma.verificationCase.groupBy({
          by: ["clientId", "status"],
          where: { tenantId: actor.tenantId, clientId: { in: ids } },
          _count: { _all: true },
        }),
        this.prisma.verificationCase.groupBy({
          by: ["clientId"],
          where: {
            tenantId: actor.tenantId,
            clientId: { in: ids },
            status: { notIn: terminalCaseStatuses },
            dueAt: { lt: now },
          },
          _count: { _all: true },
        }),
        this.prisma.clarification.findMany({
          where: {
            tenantId: actor.tenantId,
            status: "OPEN",
            case: { clientId: { in: ids } },
          },
          select: { case: { select: { clientId: true } } },
        }),
        this.prisma.invoice.findMany({
          where: {
            tenantId: actor.tenantId,
            clientId: { in: ids },
            status: { notIn: [...settledInvoiceStatuses, "DRAFT"] },
          },
          select: {
            clientId: true,
            totalAmount: true,
            paidAmount: true,
            creditedAmount: true,
            dueAt: true,
          },
        }),
        this.prisma.salesOpportunity.findMany({
          where: {
            tenantId: actor.tenantId,
            clientId: { in: ids },
            onboardingHandoffAt: { not: null },
          },
          select: { clientId: true, onboardingHandoffAt: true },
          orderBy: { onboardingHandoffAt: "desc" },
        }),
      ]);
    const balance = (row: (typeof invoices)[number]) =>
      Math.max(
        0,
        Number(row.totalAmount) -
          Number(row.paidAmount) -
          Number(row.creditedAmount),
      );
    const overdueByClient = new Map(
      overdue.map((row) => [String(row.clientId), row._count._all]),
    );
    const clarificationsByClient = tally(clarifications, (row) =>
      String(row.case.clientId),
    );
    const outstanding = tally(invoices, (row) => String(row.clientId), balance);
    const overdueAmount = tally(
      invoices.filter((row) => row.dueAt && row.dueAt < now),
      (row) => String(row.clientId),
      balance,
    );
    const items = clients.map((client) => {
      const key = String(client.id);
      const own = statuses.filter((row) => String(row.clientId) === key);
      const sum = (match: (status: string) => boolean) =>
        own
          .filter((row) => match(row.status))
          .reduce((total, row) => total + row._count._all, 0);
      return {
        id: client.publicId,
        code: client.code,
        displayName: client.displayName,
        status: client.status,
        creditHold: client.creditHold,
        total: sum(() => true),
        active: sum((status) => !terminalCaseStatuses.includes(status)),
        waitingOnClient: sum((status) => clientHeld.includes(status)),
        completed: sum((status) => ["COMPLETED", "CLOSED"].includes(status)),
        overdue: overdueByClient.get(key) ?? 0,
        openClarifications: clarificationsByClient.get(key) ?? 0,
        outstanding: Math.round((outstanding.get(key) ?? 0) * 100) / 100,
        overdueAmount: Math.round((overdueAmount.get(key) ?? 0) * 100) / 100,
        onboardingHandoffAt:
          handoffs.find((row) => String(row.clientId) === key)
            ?.onboardingHandoffAt ?? null,
      };
    });
    return pageResult(items, total, query.page, query.pageSize);
  }
}
