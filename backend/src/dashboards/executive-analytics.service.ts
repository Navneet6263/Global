import { BadRequestException, Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { ExecutiveQueryDto } from "./dto/executive-query.dto";
import {
  attentionQueue,
  average,
  caseStats,
  groupedPerformance,
  percent,
  presentCase,
  terminalStatuses,
  type ExecutiveCaseRow,
} from "./executive-analytics.helpers";
import { checkPerformance, stageAgeing, teamCapacity } from "./executive-breakdowns";

@Injectable()
export class ExecutiveAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(actor: Actor, query: ExecutiveQueryDto, registerLimit = 500) {
    const now = new Date();
    const range = this.range(query, now);
    const relationScope = actor.clientId ? { clientId: actor.clientId } : {};
    const where = {
      tenantId: actor.tenantId,
      ...relationScope,
      createdAt: { gte: range.from, lte: range.to },
      ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
      ...(query.branchId ? { branch: { publicId: query.branchId } } : {}),
      ...(query.checkType ? { checks: { some: { type: query.checkType } } } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.riskLevel
        ? { riskLevel: query.riskLevel === "UNCLASSIFIED" ? null : query.riskLevel }
        : {}),
    };
    const [cases, clients, branches, opportunities, invoices] = await Promise.all([
      this.prisma.verificationCase.findMany({
        where,
        select: {
          publicId: true, caseNumber: true, status: true, priority: true, riskLevel: true,
          createdAt: true, updatedAt: true, dueAt: true, completedAt: true,
          subject: { select: { fullName: true } },
          client: { select: { publicId: true, displayName: true } },
          branch: { select: { publicId: true, name: true } },
          assignedOpsUser: { select: { publicId: true, displayName: true } },
          checks: { select: { type: true, status: true, result: true, createdAt: true, completedAt: true } },
          clarifications: { select: { status: true } },
          fieldVisits: { select: { status: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10_000,
      }),
      this.prisma.client.findMany({
        where: { tenantId: actor.tenantId, ...(actor.clientId ? { id: actor.clientId } : {}) },
        select: { publicId: true, displayName: true },
        orderBy: { displayName: "asc" },
      }),
      this.prisma.branch.findMany({
        where: {
          tenantId: actor.tenantId,
          isActive: true,
          ...(actor.clientId ? { cases: { some: { clientId: actor.clientId } } } : {}),
        },
        select: { publicId: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.salesOpportunity.findMany({
        where: {
          tenantId: actor.tenantId,
          ...relationScope,
          createdAt: { gte: range.from, lte: range.to },
          ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
        },
        select: { stage: true, estimatedValue: true, probability: true },
        take: 10_000,
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          ...relationScope,
          createdAt: { gte: range.from, lte: range.to },
          ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
        },
        select: { status: true, totalAmount: true, paidAmount: true, dueAt: true },
        take: 10_000,
      }),
    ]);
    const rows = cases as ExecutiveCaseRow[];
    const stats = caseStats(rows, now);
    const trend = this.trend(rows, range.from, query.months, now);
    const checks = rows.flatMap((row) => row.checks);
    return {
      summary: {
        total: stats.total,
        overdue: stats.overdue,
        createdToday: rows.filter((row) => row.createdAt >= this.startOfToday(now)).length,
        completedToday: rows.filter((row) => row.completedAt && row.completedAt >= this.startOfToday(now)).length,
      },
      performance: {
        averageTatHours: stats.averageTatHours ?? 0,
        slaPercentage: stats.slaPercentage,
        completedCases: stats.completed,
      },
      statusMix: this.countBy(rows.map((row) => row.status)),
      riskMix: this.countBy(rows.map((row) => row.riskLevel ?? "UNCLASSIFIED")),
      outcomeMix: this.countBy(checks.map((check) => check.result ?? "PENDING")),
      trend: trend.map(({ month, created, completed }) => ({ month, created, completed })),
      performanceTrend: trend,
      attentionQueue: attentionQueue(rows, now),
      clientPerformance: groupedPerformance(rows, now, "client"),
      branchPerformance: groupedPerformance(rows, now, "branch"),
      stageAgeing: stageAgeing(rows, now),
      teamCapacity: teamCapacity(rows),
      checkPerformance: checkPerformance(rows),
      businessHealth: this.businessHealth(opportunities, invoices, now),
      forecast: this.forecast(rows, now),
      caseRegister: rows.slice(0, registerLimit).map(presentCase),
      recentCases: rows.slice(0, 8).map(presentCase),
      filters: {
        clients,
        branches,
        checkTypes: [...new Set(rows.flatMap((row) => row.checks.map((check) => check.type)))].sort(),
        priorities: ["LOW", "NORMAL", "HIGH", "URGENT"],
        riskLevels: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCLASSIFIED"],
        applied: { ...query, from: range.from, to: range.to },
      },
      generatedAt: now,
    };
  }

  private range(query: ExecutiveQueryDto, now: Date) {
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (query.months - 1), 1));
    const to = query.to ? new Date(query.to) : now;
    if (from > to) throw new BadRequestException("From date must be before to date");
    return { from, to };
  }

  private trend(rows: ExecutiveCaseRow[], from: Date, months: number, now: Date) {
    return Array.from({ length: months }, (_, index) => {
      const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      const created = rows.filter((row) => row.createdAt >= start && row.createdAt < end).length;
      const completedRows = rows.filter(
        (row) => row.completedAt && row.completedAt >= start && row.completedAt < end,
      );
      const eligible = completedRows.filter((row) => row.dueAt);
      return {
        month: start.toLocaleString("en", { month: "short", year: months > 6 ? "2-digit" : undefined, timeZone: "UTC" }),
        created,
        completed: completedRows.length,
        slaPercentage: percent(eligible.filter((row) => row.completedAt! <= row.dueAt!).length, eligible.length),
        averageTatHours: average(completedRows.map((row) => (row.completedAt!.getTime() - row.createdAt.getTime()) / 3_600_000)),
        overdue: rows.filter((row) => row.dueAt && row.dueAt >= start && row.dueAt < end && row.dueAt < now && !terminalStatuses.includes(row.status)).length,
      };
    });
  }

  private businessHealth(
    opportunities: Array<{ stage: string; estimatedValue: unknown; probability: number }>,
    invoices: Array<{ status: string; totalAmount: unknown; paidAmount: unknown; dueAt: Date | null }>,
    now: Date,
  ) {
    const open = opportunities.filter((item) => !["WON", "LOST"].includes(item.stage));
    const won = opportunities.filter((item) => item.stage === "WON");
    const closed = opportunities.filter((item) => ["WON", "LOST"].includes(item.stage));
    const billed = invoices.reduce((sum, item) => sum + Number(item.totalAmount), 0);
    const collected = invoices.reduce((sum, item) => sum + Number(item.paidAmount), 0);
    return {
      crm: {
        openPipeline: this.money(open.reduce((sum, item) => sum + Number(item.estimatedValue), 0)),
        weightedForecast: this.money(open.reduce((sum, item) => sum + Number(item.estimatedValue) * item.probability / 100, 0)),
        closedWon: this.money(won.reduce((sum, item) => sum + Number(item.estimatedValue), 0)),
        winRate: percent(won.length, closed.length),
      },
      finance: {
        billed: this.money(billed),
        collected: this.money(collected),
        outstanding: this.money(Math.max(0, billed - collected)),
        overdue: this.money(invoices.filter((item) => item.dueAt && item.dueAt < now && !["PAID", "CANCELLED"].includes(item.status)).reduce((sum, item) => sum + Math.max(0, Number(item.totalAmount) - Number(item.paidAmount)), 0)),
      },
    };
  }

  private forecast(rows: ExecutiveCaseRow[], now: Date) {
    const sevenDays = new Date(now.getTime() + 7 * 86_400_000);
    const active = rows.filter((row) => !terminalStatuses.includes(row.status));
    const completedLast30 = rows.filter((row) => row.completedAt && row.completedAt >= new Date(now.getTime() - 30 * 86_400_000)).length;
    return {
      dueNext7Days: active.filter((row) => row.dueAt && row.dueAt >= now && row.dueAt <= sevenDays).length,
      atRiskNext7Days: active.filter((row) => row.dueAt && row.dueAt <= sevenDays && (["HIGH", "CRITICAL"].includes(row.riskLevel ?? "") || row.priority === "URGENT")).length,
      projectedCompletions7Days: Math.round(completedLast30 / 30 * 7),
      unassignedActive: active.filter((row) => !row.assignedOpsUser).length,
    };
  }

  private countBy(values: string[]) {
    return values.reduce<Record<string, number>>((result, value) => {
      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});
  }

  private startOfToday(now: Date) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private money(value: number) {
    return Math.round(value * 100) / 100;
  }
}
