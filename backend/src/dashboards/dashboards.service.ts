import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { DashboardExceptionsService } from "./dashboard-exceptions.service";

export { presentFieldExceptions } from "./dashboard-exceptions.service";

@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exceptionDashboard: DashboardExceptionsService,
  ) {}

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
      outcomes,
      trend,
      atRisk,
    ] = await Promise.all([
      this.prisma.verificationCase.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
        _min: { updatedAt: true },
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
        where: { tenantId: actor.tenantId, case: caseAccessScope(actor) },
        _count: { _all: true },
      }),
      this.trend(actor, now),
      this.prisma.verificationCase.groupBy({
        by: ["status"],
        where: {
          status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] },
          AND: [
            scope,
            {
              OR: [
                { dueAt: { lt: now } },
                { riskLevel: { in: ["HIGH", "CRITICAL"] } },
                { priority: "URGENT" },
              ],
            },
          ],
        },
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    );
    return {
      summary: {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        overdue,
        createdToday,
        completedToday,
      },
      statusMix: counts,
      stageHealth: byStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
        oldestAgeHours: row._min.updatedAt
          ? Math.max(
              0,
              Math.round(
                (now.getTime() - row._min.updatedAt.getTime()) / 3_600_000,
              ),
            )
          : 0,
        atRisk:
          atRisk.find((risk) => risk.status === row.status)?._count._all ?? 0,
      })),
      outcomeMix: Object.fromEntries(
        outcomes.map((row) => [row.result ?? "PENDING", row._count._all]),
      ),
      trend,
      recentCases: recentCases.map(({ publicId, ...row }) => ({
        id: publicId,
        ...row,
      })),
      generatedAt: now,
    };
  }

  exceptions(actor: Actor) {
    return this.exceptionDashboard.get(actor);
  }

  private async trend(actor: Actor, now: Date) {
    const windows = monthWindows(now);
    const rangeStart = windows[0]!.start;
    const rangeEnd = windows.at(-1)!.end;
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        AND: [
          caseAccessScope(actor),
          {
            OR: [
              { createdAt: { gte: rangeStart, lt: rangeEnd } },
              { completedAt: { gte: rangeStart, lt: rangeEnd } },
            ],
          },
        ],
      },
      select: { createdAt: true, completedAt: true },
    });
    return windows.map(({ start, end, label }) => ({
      month: label,
      created: rows.filter(
        (row) => row.createdAt >= start && row.createdAt < end,
      ).length,
      completed: rows.filter(
        (row) =>
          row.completedAt && row.completedAt >= start && row.completedAt < end,
      ).length,
    }));
  }
}

function monthWindows(now: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1),
    );
    return {
      start,
      end: new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      ),
      label: start.toLocaleString("en", { month: "short", timeZone: "UTC" }),
    };
  });
}
