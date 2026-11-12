import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { hasAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";

export type TaskSlaFilter = "OVERDUE" | "DUE_TODAY" | "DUE_SOON";
export const ACTIVE_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED"];

function actorCaseConstraint(
  actor: Actor,
): Prisma.VerificationCaseWhereInput | undefined {
  if (!actor.branchId && !actor.clientId) return undefined;
  return {
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
    ...(actor.clientId ? { clientId: actor.clientId } : {}),
  };
}

/** Verification department IDs led by this actor (excludes Data Entry teams). */
export function verificationLedDepartmentIds(actor: Actor): bigint[] {
  return (actor.departments ?? [])
    .filter(
      (department) =>
        department.role === "LEAD" && department.kind !== "DATA_ENTRY",
    )
    .map((department) => department.id);
}

/** Verification department IDs where this actor holds any active membership. */
export function verificationDepartmentIds(actor: Actor): bigint[] {
  return (actor.departments ?? [])
    .filter((department) => department.kind !== "DATA_ENTRY")
    .map((department) => department.id);
}

/**
 * Resolves an optional department UUID query filter and enforces role boundaries:
 * - Operations/Platform Admin: any tenant VERIFICATION department.
 * - Verification TL: only a department they lead.
 * - Plain Verifier: only a department they belong to.
 */
export async function resolveVerificationDepartmentId(
  prisma: PrismaService,
  actor: Actor,
  departmentPublicId?: string,
): Promise<bigint | undefined> {
  if (!departmentPublicId) return undefined;
  const department = await prisma.department.findFirst({
    where: {
      publicId: departmentPublicId,
      tenantId: actor.tenantId,
      kind: "VERIFICATION",
    },
    select: { id: true },
  });
  if (!department) throw new NotFoundException("Verification team not found");
  if (hasAnyRole(actor, OPERATIONS_ROLES)) return department.id;
  const ledIds = verificationLedDepartmentIds(actor);
  if (ledIds.length) {
    if (!ledIds.includes(department.id))
      throw new ForbiddenException("You do not lead this department");
    return department.id;
  }
  const memberIds = verificationDepartmentIds(actor);
  if (!memberIds.includes(department.id))
    throw new ForbiddenException("You do not belong to this department");
  return department.id;
}

export function taskAccessScope(actor: Actor): Prisma.CheckTaskWhereInput {
  const supervisor = hasAnyRole(actor, OPERATIONS_ROLES);
  const caseScope = actorCaseConstraint(actor);
  return {
    tenantId: actor.tenantId,
    ...(!supervisor ? { assigneeId: actor.userId } : {}),
    ...(caseScope ? { check: { case: caseScope } } : {}),
  };
}

/**
 * Access scope for Verifier My Checks / Task Insights / Task Context:
 * - Supervisors: all claimed tasks across all departments unless `departmentPublicId`
 *   is selected, in which case only that department's claimed tasks; never UNASSIGNED.
 * - Team Leaders: all claimed tasks in their led/selected verification department; never UNASSIGNED.
 * - Regular Verifiers: only tasks assigned directly to them (scoped by department if requested).
 */
export async function resolveTaskAccessScope(
  prisma: PrismaService,
  actor: Actor,
  departmentPublicId?: string,
): Promise<Prisma.CheckTaskWhereInput> {
  const departmentId = await resolveVerificationDepartmentId(
    prisma,
    actor,
    departmentPublicId,
  );
  const caseScope = actorCaseConstraint(actor);
  const supervisor = hasAnyRole(actor, OPERATIONS_ROLES);
  if (supervisor) {
    return {
      tenantId: actor.tenantId,
      assigneeId: { not: null },
      status: { not: "UNASSIGNED" },
      check: {
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(caseScope ? { case: caseScope } : {}),
      },
    };
  }
  const ledIds = verificationLedDepartmentIds(actor);
  if (ledIds.length) {
    return {
      tenantId: actor.tenantId,
      assigneeId: { not: null },
      status: { not: "UNASSIGNED" },
      check: {
        departmentId: departmentId !== undefined ? departmentId : { in: ledIds },
        ...(caseScope ? { case: caseScope } : {}),
      },
    };
  }
  return {
    tenantId: actor.tenantId,
    assigneeId: actor.userId,
    ...(departmentId !== undefined || caseScope
      ? {
          check: {
            ...(departmentId !== undefined ? { departmentId } : {}),
            ...(caseScope ? { case: caseScope } : {}),
          },
        }
      : {}),
  };
}

/** Restricts check read queries for non-supervisor verifiers to their own tasks or led teams. */
export function scopedVerifierCheckWhere(
  actor: Actor,
): Prisma.CaseCheckWhereInput | undefined {
  if (
    hasAnyRole(actor, OPERATIONS_ROLES) ||
    hasAnyRole(actor, ["QA_REVIEWER", "SPOC_RM"])
  ) {
    return undefined;
  }
  const ledIds = verificationLedDepartmentIds(actor);
  return {
    OR: [
      ...(ledIds.length ? [{ departmentId: { in: ledIds } }] : []),
      { tasks: { some: { assigneeId: actor.userId } } },
    ],
  };
}

export function taskSlaWhere(
  sla: TaskSlaFilter | undefined,
  now = new Date(),
): Prisma.CheckTaskWhereInput {
  if (!sla) return {};
  if (sla === "OVERDUE") {
    return { dueAt: { lt: now }, status: { not: "COMPLETED" } };
  }
  if (sla === "DUE_SOON") {
    return {
      dueAt: { gte: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      status: { not: "COMPLETED" },
    };
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { dueAt: { gte: start, lt: end }, status: { not: "COMPLETED" } };
}

export function startOfDay(value = new Date()) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}
