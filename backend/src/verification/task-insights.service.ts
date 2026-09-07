import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { startOfDay, taskAccessScope } from "./task-query.helpers";

@Injectable()
export class TaskInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor) {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueSoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const access = taskAccessScope(actor);
    const activeStatuses = ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"];

    const [
      active,
      open,
      inProgress,
      blocked,
      overdue,
      dueToday,
      dueNext24h,
      totalCompleted,
      rows,
    ] = await Promise.all([
      this.prisma.checkTask.count({
        where: { ...access, status: { in: activeStatuses } },
      }),
      this.prisma.checkTask.count({
        where: { ...access, status: { in: ["UNASSIGNED", "OPEN"] } },
      }),
      this.prisma.checkTask.count({
        where: { ...access, status: "IN_PROGRESS" },
      }),
      this.prisma.checkTask.count({ where: { ...access, status: "BLOCKED" } }),
      this.prisma.checkTask.count({
        where: { ...access, status: { not: "COMPLETED" }, dueAt: { lt: now } },
      }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { not: "COMPLETED" },
          dueAt: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { not: "COMPLETED" },
          dueAt: { gte: now, lte: dueSoon },
        },
      }),
      this.prisma.checkTask.count({
        where: { ...access, status: "COMPLETED" },
      }),
      this.prisma.checkTask.findMany({
        where: {
          ...access,
          status: "COMPLETED",
          completedAt: { gte: sevenDaysAgo },
        },
        select: {
          startedAt: true,
          completedAt: true,
          dueAt: true,
          check: { select: { result: true, type: true } },
        },
        orderBy: { completedAt: "asc" },
      }),
    ]);

    const completedToday = rows.filter(
      (row) => row.completedAt! >= today,
    ).length;
    const withinSla = rows.filter(
      (row) => row.completedAt && (!row.dueAt || row.completedAt <= row.dueAt),
    ).length;
    const turnaround = rows
      .filter((row) => row.startedAt && row.completedAt)
      .map(
        (row) =>
          (row.completedAt!.getTime() - row.startedAt!.getTime()) / 60_000,
      );
    const outcomes = { clear: 0, discrepancy: 0, unableToVerify: 0 };
    rows.forEach((row) => {
      if (row.check.result === "CLEAR") outcomes.clear += 1;
      if (row.check.result === "DISCREPANCY") outcomes.discrepancy += 1;
      if (row.check.result === "UNABLE_TO_VERIFY") outcomes.unableToVerify += 1;
    });

    return {
      summary: {
        active,
        open,
        inProgress,
        blocked,
        overdue,
        dueToday,
        dueNext24h,
        completedToday,
        completedThisWeek: rows.length,
        totalCompleted,
        averageTurnaroundMinutes: average(turnaround),
        slaSampleSize: rows.length,
        slaHitRate: rows.length
          ? Math.round((withinSla / rows.length) * 100)
          : null,
      },
      outcomes,
      daily: dailySeries(
        rows.map((row) => row.completedAt!),
        sevenDaysAgo,
      ),
    };
  }
}

function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
}

export function dailySeries(completedAt: Date[], firstDay: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      date: localDateKey(day),
      completed: completedAt.filter((value) => value >= day && value < next)
        .length,
    };
  });
}

function localDateKey(day: Date) {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}
