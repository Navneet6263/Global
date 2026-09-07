import { Injectable } from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

const activeTaskStates = ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"];

@Injectable()
export class VerifierCapacityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);
    const userScope =
      !actor.roles.includes("PLATFORM_ADMIN") && actor.branchId
        ? { branchId: actor.branchId }
        : {};
    const [users, tasks, openChecks] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          ...userScope,
          userRoles: { some: { role: { code: "VERIFIER" } } },
        },
        select: {
          publicId: true,
          displayName: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
      }),
      this.prisma.checkTask.findMany({
        where: {
          tenantId: actor.tenantId,
          check: { case: caseAccessScope(actor) },
        },
        select: {
          status: true,
          dueAt: true,
          startedAt: true,
          completedAt: true,
          assignee: { select: { publicId: true } },
          check: {
            select: {
              type: true,
              case: { select: { publicId: true } },
            },
          },
        },
      }),
      this.prisma.caseCheck.findMany({
        where: {
          tenantId: actor.tenantId,
          status: { not: "COMPLETED" },
          case: caseAccessScope(actor),
        },
        select: {
          type: true,
          tasks: {
            where: { status: { in: activeTaskStates } },
            select: { assigneeId: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    const initialMembers = users.map((user) => {
      const owned = tasks.filter(
        (task) => task.assignee?.publicId === user.publicId,
      );
      const active = owned.filter((task) =>
        activeTaskStates.includes(task.status),
      );
      const turnaround = owned.flatMap((task) =>
        task.startedAt && task.completedAt
          ? [
              Math.max(
                0,
                Math.round(
                  (task.completedAt.getTime() - task.startedAt.getTime()) /
                    60_000,
                ),
              ),
            ]
          : [],
      );
      return {
        id: user.publicId,
        name: user.displayName,
        role: "Verifier",
        branch: user.branch?.name ?? "No branch assigned",
        activeCases: new Set(active.map((task) => task.check.case.publicId))
          .size,
        activeChecks: active.length,
        dueToday: active.filter(
          (task) =>
            task.dueAt && task.dueAt >= startToday && task.dueAt < endToday,
        ).length,
        overdue: active.filter((task) => task.dueAt && task.dueAt < now)
          .length,
        completedToday: owned.filter(
          (task) =>
            task.completedAt &&
            task.completedAt >= startToday &&
            task.completedAt < endToday,
        ).length,
        averageTurnaroundMinutes: turnaround.length
          ? Math.round(
              turnaround.reduce((sum, value) => sum + value, 0) /
                turnaround.length,
            )
          : null,
        relativeLoadPercent: 0,
      };
    });
    const peak = Math.max(
      ...initialMembers.map((member) => member.activeChecks),
      1,
    );
    const members = initialMembers.map((member) => ({
      ...member,
      relativeLoadPercent: Math.round((member.activeChecks / peak) * 100),
    }));
    const totalActive = Math.max(
      1,
      members.reduce((sum, member) => sum + member.activeChecks, 0),
    );
    const branches = [...new Set(members.map((member) => member.branch))].map(
      (branch) => {
        const rows = members.filter((member) => member.branch === branch);
        const open = rows.reduce((sum, member) => sum + member.activeChecks, 0);
        return {
          branch,
          members: rows.length,
          openChecks: open,
          loadPercent: Math.round((open / totalActive) * 100),
        };
      },
    );
    const demand = [...new Set(openChecks.map((check) => check.type))].map(
      (type) => ({
        checkType: normalizeCheckType(type),
        open: openChecks.filter((check) => check.type === type).length,
      }),
    );
    return {
      members,
      workload: members.map((member) => ({
        name: member.name,
        checks: member.activeChecks,
      })),
      branches,
      demand,
      openAssignments: openChecks.filter(
        (check) => !check.tasks[0]?.assigneeId,
      ).length,
    };
  }
}

function normalizeCheckType(value: string) {
  const type = value.toLowerCase();
  return [
    "identity",
    "address",
    "employment",
    "education",
    "criminal",
    "reference",
  ].includes(type)
    ? type
    : "identity";
}
