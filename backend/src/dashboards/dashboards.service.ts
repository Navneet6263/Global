import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async operations(actor: Actor) {
    const scope = caseAccessScope(actor);
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const [
      byStatus,
      overdue,
      createdToday,
      completedToday,
      recentCases,
      checkOutcomes,
      trend,
    ] = await Promise.all([
      this.prisma.verificationCase.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.verificationCase.count({
        where: {
          ...scope,
          dueAt: { lt: now },
          status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
        },
      }),
      this.prisma.verificationCase.count({
        where: { ...scope, createdAt: { gte: startToday } },
      }),
      this.prisma.verificationCase.count({
        where: { ...scope, completedAt: { gte: startToday } },
      }),
      this.prisma.verificationCase.findMany({
        where: scope,
        select: {
          publicId: true,
          caseNumber: true,
          status: true,
          priority: true,
          dueAt: true,
          updatedAt: true,
          subject: { select: { fullName: true } },
          client: { select: { displayName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      this.prisma.caseCheck.groupBy({
        by: ["result"],
        where: {
          tenantId: actor.tenantId,
          ...(actor.clientId ? { case: { clientId: actor.clientId } } : {}),
        },
        _count: { _all: true },
      }),
      this.trend(actor, now),
    ]);
    const counts = Object.fromEntries(
      byStatus.map((item) => [item.status, item._count._all]),
    );
    return {
      summary: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        overdue,
        createdToday,
        completedToday,
      },
      statusMix: counts,
      outcomeMix: Object.fromEntries(
        checkOutcomes.map((item) => [
          item.result ?? "PENDING",
          item._count._all,
        ]),
      ),
      trend,
      recentCases: recentCases.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      generatedAt: now,
    };
  }

  async executive(actor: Actor) {
    const scope = caseAccessScope(actor);
    const [operations, risks, completed] = await Promise.all([
      this.operations(actor),
      this.prisma.verificationCase.groupBy({
        by: ["riskLevel"],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.verificationCase.findMany({
        where: { ...scope, completedAt: { not: null } },
        select: { createdAt: true, completedAt: true, dueAt: true },
        orderBy: { completedAt: "desc" },
        take: 5000,
      }),
    ]);
    const durations = completed.map(
      (item) => item.completedAt!.getTime() - item.createdAt.getTime(),
    );
    const averageTatHours = durations.length
      ? durations.reduce((sum, value) => sum + value, 0) /
        durations.length /
        3_600_000
      : 0;
    const withinSla = completed.filter(
      (item) => item.dueAt && item.completedAt! <= item.dueAt,
    ).length;
    return {
      ...operations,
      performance: {
        averageTatHours: Math.round(averageTatHours * 10) / 10,
        slaPercentage: completed.length
          ? Math.round((withinSla / completed.length) * 1000) / 10
          : 100,
        completedCases: completed.length,
      },
      riskMix: Object.fromEntries(
        risks.map((item) => [
          item.riskLevel ?? "UNCLASSIFIED",
          item._count._all,
        ]),
      ),
    };
  }

  async exceptions(actor: Actor) {
    const scope = caseAccessScope(actor);
    const now = new Date();
    const overdueWhere = {
      ...scope,
      dueAt: { lt: now },
      status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
    };
    const clarificationWhere = {
      tenantId: actor.tenantId,
      status: { in: ["OPEN", "RESPONDED"] },
      ...(actor.clientId ? { case: { clientId: actor.clientId } } : {}),
    };
    const fieldWhere = {
      tenantId: actor.tenantId,
      status: "EXCEPTION_REVIEW",
      ...(actor.clientId ? { case: { clientId: actor.clientId } } : {}),
    };
    const [
      overdueCount,
      clarificationCount,
      fieldCount,
      overdue,
      clarifications,
      fieldVisits,
    ] = await Promise.all([
      this.prisma.verificationCase.count({ where: overdueWhere }),
      this.prisma.clarification.count({ where: clarificationWhere }),
      this.prisma.fieldVisit.count({ where: fieldWhere }),
      this.prisma.verificationCase.findMany({
        where: overdueWhere,
        select: {
          publicId: true,
          caseNumber: true,
          status: true,
          priority: true,
          dueAt: true,
          subject: { select: { fullName: true } },
          client: { select: { displayName: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 100,
      }),
      this.prisma.clarification.findMany({
        where: clarificationWhere,
        select: {
          publicId: true,
          status: true,
          subject: true,
          dueAt: true,
          updatedAt: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ status: "desc" }, { updatedAt: "asc" }],
        take: 100,
      }),
      this.prisma.fieldVisit.findMany({
        where: fieldWhere,
        select: {
          publicId: true,
          address: true,
          distanceMeters: true,
          geofenceMeters: true,
          capturedAt: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
          assignee: { select: { displayName: true } },
        },
        orderBy: { capturedAt: "asc" },
        take: 100,
      }),
    ]);
    return {
      summary: {
        overdue: overdueCount,
        clarifications: clarificationCount,
        fieldExceptions: fieldCount,
        total: overdueCount + clarificationCount + fieldCount,
      },
      overdue: overdue.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      clarifications: clarifications.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      fieldVisits: fieldVisits.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      generatedAt: now,
    };
  }

  private async trend(actor: Actor, now: Date) {
    const months = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1),
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      );
      return {
        start,
        end,
        label: start.toLocaleString("en", { month: "short", timeZone: "UTC" }),
      };
    });
    return Promise.all(
      months.map(async ({ start, end, label }) => {
        const scope = caseAccessScope(actor);
        const [created, completed] = await Promise.all([
          this.prisma.verificationCase.count({
            where: { ...scope, createdAt: { gte: start, lt: end } },
          }),
          this.prisma.verificationCase.count({
            where: { ...scope, completedAt: { gte: start, lt: end } },
          }),
        ]);
        return { month: label, created, completed };
      }),
    );
  }
}
