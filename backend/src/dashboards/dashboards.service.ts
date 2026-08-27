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
      resolvedToday,
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
          createdAt: true,
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
          createdAt: true,
          messages: {
            select: { senderType: true, body: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
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
          createdAt: true,
          version: true,
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
      this.prisma.auditEvent.count({
        where: {
          tenantId: actor.tenantId,
          action: {
            in: [
              "clarification.resolved",
              "field_visit.exception-approved",
              "field_visit.retry-requested",
            ],
          },
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
    ]);
    const affectedCaseIds = new Set([
      ...overdue.map((item) => item.publicId),
      ...clarifications.map((item) => item.case.publicId),
      ...fieldVisits.map((item) => item.case.publicId),
    ]);
    const ages = [
      ...overdue.map(
        (item) => (now.getTime() - item.createdAt.getTime()) / 3_600_000,
      ),
      ...clarifications.map(
        (item) => (now.getTime() - item.createdAt.getTime()) / 3_600_000,
      ),
      ...fieldVisits.map(
        (item) => (now.getTime() - item.createdAt.getTime()) / 3_600_000,
      ),
    ];
    return {
      summary: {
        overdue: overdueCount,
        clarifications: clarificationCount,
        fieldExceptions: fieldCount,
        total: overdueCount + clarificationCount + fieldCount,
        uniqueCases: affectedCaseIds.size,
        critical:
          overdue.filter((item) => item.priority === "URGENT").length +
          fieldCount,
        resolvedToday,
        averageAgeHours: ages.length
          ? Math.round(
              ages.reduce((total, age) => total + age, 0) / ages.length,
            )
          : 0,
      },
      overdue: overdue.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      clarifications: clarifications.map(({ publicId, messages, ...item }) => ({
        id: publicId,
        ...item,
        latestMessage: messages[0] ?? null,
      })),
      fieldVisits: fieldVisits.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
      })),
      generatedAt: now,
    };
  }

  private async trend(actor: Actor, now: Date) {
    const months = this.monthWindows(now);
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

  private monthWindows(now: Date) {
    return Array.from({ length: 6 }, (_, index) => {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1),
      );
      return {
        start,
        end: new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
        ),
        label: start.toLocaleString("en", {
          month: "short",
          timeZone: "UTC",
        }),
      };
    });
  }
}
