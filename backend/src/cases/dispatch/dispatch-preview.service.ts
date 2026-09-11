import { Injectable } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { caseAccessScope } from "../../common/auth/access-scope";
import { assertAnyRole, OPERATIONS_ROLES } from "../../common/auth/roles";
import { PrismaService } from "../../database/prisma.service";
import { ACTIVE_TASK_STATUSES } from "../../verification/bulk-task-assignment.helpers";
import {
  dispatchCaseSelect,
  matchesVerifier,
  presentDispatchCase,
} from "./dispatch.policy";

@Injectable()
export class DispatchPreviewService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(actor: Actor, caseIds: string[]) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can dispatch cases",
    );
    const records = await this.prisma.verificationCase.findMany({
      where: { ...caseAccessScope(actor), publicId: { in: caseIds } },
      select: dispatchCaseSelect,
    });
    const verifiers = records.length
      ? await this.prisma.user.findMany({
          where: {
            tenantId: actor.tenantId,
            status: "ACTIVE",
            userRoles: { some: { role: { code: "VERIFIER" } } },
            OR: records.map((record) => ({
              AND: [
                { OR: [{ branchId: null }, { branchId: record.branchId }] },
                { OR: [{ clientId: null }, { clientId: record.clientId }] },
              ],
            })),
          },
          select: {
            id: true,
            publicId: true,
            displayName: true,
            email: true,
            branchId: true,
            clientId: true,
            branch: { select: { name: true } },
          },
          orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
          take: 251,
        })
      : [];
    const members = verifiers.slice(0, 250);
    const where = {
      tenantId: actor.tenantId,
      assigneeId: { in: members.map((user) => user.id) },
      status: { in: ACTIVE_TASK_STATUSES },
      check: { case: caseAccessScope(actor) },
    };
    const [workload, overdue] = members.length
      ? await Promise.all([
          this.prisma.checkTask.groupBy({
            by: ["assigneeId"],
            where,
            _count: { _all: true },
          }),
          this.prisma.checkTask.groupBy({
            by: ["assigneeId"],
            where: {
              ...where,
              OR: [
                { dueAt: { lt: new Date() } },
                {
                  dueAt: null,
                  check: {
                    case: {
                      ...caseAccessScope(actor),
                      dueAt: { lt: new Date() },
                    },
                  },
                },
              ],
            },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const activeMap = new Map(
      workload.map((row) => [row.assigneeId, row._count._all]),
    );
    const overdueMap = new Map(
      overdue.map((row) => [row.assigneeId, row._count._all]),
    );
    const cases = records.map((record) => {
      const result = presentDispatchCase(record);
      const eligibleVerifierIds = members
        .filter((user) => matchesVerifier(record, user))
        .map((user) => user.publicId);
      if (!eligibleVerifierIds.length)
        result.issues.push(
          "No active verifier matches this client's branch/scope",
        );
      return { ...result, ready: !result.issues.length, eligibleVerifierIds };
    });
    return {
      cases,
      unavailableIds: caseIds.filter(
        (id) =>
          !records.some(
            (record) => record.publicId.toLowerCase() === id.toLowerCase(),
          ),
      ),
      verifiers: members.map((user) => ({
        id: user.publicId,
        name: user.displayName,
        email: user.email,
        branchName: user.branch?.name ?? "All branches",
        activeChecks: activeMap.get(user.id) ?? 0,
        overdue: overdueMap.get(user.id) ?? 0,
      })),
      verifierLimitReached: verifiers.length > 250,
      workloadScope: "Current authorised workspace",
    };
  }
}
