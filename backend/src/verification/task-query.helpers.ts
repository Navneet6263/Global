import type { Actor } from "../common/auth/actor";
import { hasAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import type { Prisma } from "../generated/prisma/client";

export type TaskSlaFilter = "OVERDUE" | "DUE_TODAY" | "DUE_SOON";

export function taskAccessScope(actor: Actor): Prisma.CheckTaskWhereInput {
  const supervisor = hasAnyRole(actor, OPERATIONS_ROLES);
  return {
    tenantId: actor.tenantId,
    ...(!supervisor ? { assigneeId: actor.userId } : {}),
    ...(actor.branchId || actor.clientId
      ? {
          check: {
            case: {
              ...(actor.branchId ? { branchId: actor.branchId } : {}),
              ...(actor.clientId ? { clientId: actor.clientId } : {}),
            },
          },
        }
      : {}),
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
