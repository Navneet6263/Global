import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { caseColour, effectiveDisposition } from "../verification/dispositions";
import type { ExecutiveQueryDto } from "./dto/executive-query.dto";
import {
  attentionQueue,
  caseStats,
  groupedPerformance,
  presentCase,
  type ExecutiveCaseRow,
} from "./executive-analytics.helpers";
import {
  checkPerformance,
  stageAgeing,
  teamCapacity,
} from "./executive-breakdowns";
import {
  businessHealth,
  completionForecast,
  countBy,
  executiveRange,
  executiveTrend,
  startOfToday,
} from "./executive-metrics";

@Injectable()
export class ExecutiveAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(actor: Actor, query: ExecutiveQueryDto, registerLimit = 500) {
    const now = new Date();
    const range = executiveRange(query, now);
    const isPlatformAdmin = actor.roles.includes("PLATFORM_ADMIN");
    const scopedBranchId = isPlatformAdmin ? undefined : actor.branchId;
    const scopedClientId = isPlatformAdmin ? undefined : actor.clientId;
    const relationScope = scopedClientId ? { clientId: scopedClientId } : {};
    const where = {
      ...caseAccessScope(actor),
      createdAt: { gte: range.from, lte: range.to },
      ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
      ...(query.branchId ? { branch: { publicId: query.branchId } } : {}),
      ...(query.checkType
        ? { checks: { some: { type: query.checkType } } }
        : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.riskLevel
        ? {
            riskLevel:
              query.riskLevel === "UNCLASSIFIED" ? null : query.riskLevel,
          }
        : {}),
    };
    const [cases, clients, branches, opportunities, invoices] =
      await Promise.all([
        this.prisma.verificationCase.findMany({
          where,
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            priority: true,
            riskLevel: true,
            createdAt: true,
            updatedAt: true,
            dueAt: true,
            completedAt: true,
            subject: { select: { fullName: true } },
            client: { select: { publicId: true, displayName: true } },
            branch: { select: { publicId: true, name: true } },
            assignedOpsUser: { select: { publicId: true, displayName: true } },
            checks: {
              select: {
                type: true,
                status: true,
                result: true,
                disposition: true,
                createdAt: true,
                completedAt: true,
              },
            },
            clarifications: { select: { status: true } },
            fieldVisits: { select: { status: true } },
          },
          orderBy: { updatedAt: "desc" },
        }),
        this.prisma.client.findMany({
          where: {
            tenantId: actor.tenantId,
            ...(scopedClientId ? { id: scopedClientId } : {}),
            ...(scopedBranchId
              ? { cases: { some: { branchId: scopedBranchId } } }
              : {}),
          },
          select: { publicId: true, displayName: true },
          orderBy: { displayName: "asc" },
        }),
        this.prisma.branch.findMany({
          where: {
            tenantId: actor.tenantId,
            isActive: true,
            ...(scopedBranchId ? { id: scopedBranchId } : {}),
            ...(scopedClientId
              ? { cases: { some: { clientId: scopedClientId } } }
              : {}),
          },
          select: { publicId: true, name: true },
          orderBy: { name: "asc" },
        }),
        scopedBranchId
          ? Promise.resolve([])
          : this.prisma.salesOpportunity.findMany({
              where: {
                tenantId: actor.tenantId,
                ...relationScope,
                createdAt: { gte: range.from, lte: range.to },
                ...(query.clientId
                  ? { client: { publicId: query.clientId } }
                  : {}),
              },
              select: { stage: true, estimatedValue: true, probability: true },
            }),
        scopedBranchId
          ? Promise.resolve([])
          : this.prisma.invoice.findMany({
              where: {
                tenantId: actor.tenantId,
                ...relationScope,
                createdAt: { gte: range.from, lte: range.to },
                ...(query.clientId
                  ? { client: { publicId: query.clientId } }
                  : {}),
              },
              select: {
                status: true,
                totalAmount: true,
                paidAmount: true,
                creditedAmount: true,
                dueAt: true,
              },
            }),
      ]);
    const rows = cases as ExecutiveCaseRow[];
    const stats = caseStats(rows, now);
    const trend = executiveTrend(rows, range.from, range.to, now);
    const checks = rows.flatMap((row) => row.checks);
    return {
      summary: {
        total: stats.total,
        overdue: stats.overdue,
        createdToday: rows.filter((row) => row.createdAt >= startOfToday(now))
          .length,
        completedToday: rows.filter(
          (row) => row.completedAt && row.completedAt >= startOfToday(now),
        ).length,
      },
      performance: {
        averageTatHours: stats.averageTatHours,
        slaPercentage: stats.slaPercentage,
        completedCases: stats.completed,
      },
      statusMix: countBy(rows.map((row) => row.status)),
      riskMix: countBy(rows.map((row) => row.riskLevel ?? "UNCLASSIFIED")),
      outcomeMix: countBy(checks.map((check) => check.result ?? "PENDING")),
      // Colour codes: per check, and per case (the most serious check decides).
      dispositionMix: countBy(
        checks.flatMap((check) => {
          const value = effectiveDisposition(check);
          return value ? [value] : [];
        }),
      ),
      caseColourMix: countBy(
        rows.flatMap((row) => {
          const value = caseColour(row.checks);
          return value ? [value] : [];
        }),
      ),
      clientColours: clientColourRows(rows),
      trend: trend.map(({ month, created, completed }) => ({
        month,
        created,
        completed,
      })),
      performanceTrend: trend,
      attentionQueue: attentionQueue(rows, now),
      clientPerformance: groupedPerformance(rows, now, "client"),
      branchPerformance: groupedPerformance(rows, now, "branch"),
      stageAgeing: stageAgeing(rows, now),
      teamCapacity: teamCapacity(rows),
      checkPerformance: checkPerformance(rows),
      businessHealth: businessHealth(opportunities, invoices, now),
      forecast: completionForecast(rows, now),
      caseRegister: rows.slice(0, registerLimit).map(presentCase),
      recentCases: rows.slice(0, 8).map(presentCase),
      filters: {
        clients,
        branches,
        checkTypes: [
          ...new Set(
            rows.flatMap((row) => row.checks.map((check) => check.type)),
          ),
        ].sort(),
        priorities: ["LOW", "NORMAL", "HIGH", "URGENT"],
        riskLevels: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCLASSIFIED"],
        applied: { ...query, from: range.from, to: range.to },
      },
      generatedAt: now,
    };
  }
}

function clientColourRows(
  rows: Array<{
    client: { publicId: string; displayName: string };
    checks: Array<{ result: string | null; disposition?: string | null }>;
  }>,
) {
  const byClient = new Map<
    string,
    { id: string; name: string; colours: Record<string, number> }
  >();
  for (const row of rows) {
    const colour = caseColour(row.checks);
    if (!colour) continue;
    const entry = byClient.get(row.client.publicId) ?? {
      id: row.client.publicId,
      name: row.client.displayName,
      colours: {},
    };
    entry.colours[colour] = (entry.colours[colour] ?? 0) + 1;
    byClient.set(row.client.publicId, entry);
  }
  return [...byClient.values()].sort(
    (a, b) =>
      Object.values(b.colours).reduce((x, y) => x + y, 0) -
      Object.values(a.colours).reduce((x, y) => x + y, 0),
  );
}
