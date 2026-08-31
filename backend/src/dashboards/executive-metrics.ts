import { BadRequestException } from "@nestjs/common";
import type { ExecutiveQueryDto } from "./dto/executive-query.dto";
import {
  average,
  percent,
  terminalStatuses,
  type ExecutiveCaseRow,
} from "./executive-analytics.helpers";

export function executiveRange(query: ExecutiveQueryDto, now: Date) {
  const from = query.from
    ? new Date(query.from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (query.months - 1), 1));
  const to = query.to ? new Date(query.to) : now;
  if (from > to) throw new BadRequestException("From date must be before to date");
  return { from, to };
}

export function executiveTrend(rows: ExecutiveCaseRow[], from: Date, to: Date, now: Date) {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  const bucketDays = days <= 31 ? 1 : days <= 120 ? 7 : 30;
  const buckets = Math.ceil(days / bucketDays);
  return Array.from({ length: buckets }, (_, index) => {
    const start = new Date(from.getTime() + index * bucketDays * 86_400_000);
    const end = new Date(Math.min(to.getTime() + 1, start.getTime() + bucketDays * 86_400_000));
    const completed = rows.filter(
      (row) => row.completedAt && row.completedAt >= start && row.completedAt < end,
    );
    const eligible = completed.filter((row) => row.dueAt);
    return {
      month: bucketLabel(start, bucketDays, days),
      created: rows.filter((row) => row.createdAt >= start && row.createdAt < end).length,
      completed: completed.length,
      slaPercentage: percent(
        eligible.filter((row) => row.completedAt! <= row.dueAt!).length,
        eligible.length,
      ),
      averageTatHours: average(
        completed.map(
          (row) => (row.completedAt!.getTime() - row.createdAt.getTime()) / 3_600_000,
        ),
      ),
      overdue: rows.filter(
        (row) =>
          row.dueAt &&
          row.dueAt >= start &&
          row.dueAt < end &&
          row.dueAt < now &&
          !terminalStatuses.includes(row.status),
      ).length,
    };
  });
}

export function businessHealth(
  opportunities: Array<{ stage: string; estimatedValue: unknown; probability: number }>,
  invoices: Array<{
    status: string;
    totalAmount: unknown;
    paidAmount: unknown;
    creditedAmount: unknown;
    dueAt: Date | null;
  }>,
  now: Date,
) {
  const open = opportunities.filter((row) => !["WON", "LOST"].includes(row.stage));
  const won = opportunities.filter((row) => row.stage === "WON");
  const closed = opportunities.filter((row) => ["WON", "LOST"].includes(row.stage));
  const activeInvoices = invoices.filter((row) => row.status !== "CANCELLED");
  const billed = sum(activeInvoices, (row) => Number(row.totalAmount));
  const collected = sum(activeInvoices, (row) => Number(row.paidAmount));
  const balance = (row: (typeof invoices)[number]) =>
    Math.max(
      0,
      Number(row.totalAmount) -
        Number(row.paidAmount) -
        Number(row.creditedAmount),
    );
  return {
    crm: {
      openPipeline: money(sum(open, (row) => Number(row.estimatedValue))),
      weightedForecast: money(
        sum(open, (row) => (Number(row.estimatedValue) * row.probability) / 100),
      ),
      closedWon: money(sum(won, (row) => Number(row.estimatedValue))),
      winRate: percent(won.length, closed.length),
    },
    finance: {
      billed: money(billed),
      collected: money(collected),
      outstanding: money(sum(activeInvoices, balance)),
      overdue: money(
        sum(
          invoices.filter(
            (row) =>
              row.dueAt &&
              row.dueAt < now &&
              !["PAID", "CANCELLED", "CREDITED", "SETTLED"].includes(
                row.status,
              ),
          ),
          balance,
        ),
      ),
    },
  };
}

export function completionForecast(rows: ExecutiveCaseRow[], now: Date) {
  const sevenDays = new Date(now.getTime() + 7 * 86_400_000);
  const active = rows.filter((row) => !terminalStatuses.includes(row.status));
  const completedLast30 = rows.filter(
    (row) => row.completedAt && row.completedAt >= new Date(now.getTime() - 30 * 86_400_000),
  ).length;
  return {
    dueNext7Days: active.filter((row) => row.dueAt && row.dueAt >= now && row.dueAt <= sevenDays)
      .length,
    atRiskNext7Days: active.filter(
      (row) =>
        row.dueAt &&
        row.dueAt <= sevenDays &&
        (["HIGH", "CRITICAL"].includes(row.riskLevel ?? "") || row.priority === "URGENT"),
    ).length,
    projectedCompletions7Days: Math.round((completedLast30 / 30) * 7),
    unassignedActive: active.filter((row) => !row.assignedOpsUser).length,
  };
}

export function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

export function startOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function bucketLabel(start: Date, bucketDays: number, days: number) {
  return start.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: bucketDays > 1 && days > 365 ? "2-digit" : undefined,
    timeZone: "UTC",
  });
}

function sum<T>(rows: T[], value: (row: T) => number) {
  return rows.reduce((total, row) => total + value(row), 0);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}
