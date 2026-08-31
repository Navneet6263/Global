import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
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
      tenantId: actor.tenantId,
      ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
      ...relationScope,
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
        createdToday: rows.filter(
          (row) => row.createdAt >= startOfToday(now),
        ).length,
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
      outcomeMix: countBy(
        checks.map((check) => check.result ?? "PENDING"),
      ),
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
