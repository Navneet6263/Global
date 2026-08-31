import type { Actor } from "./actor";

export function caseAccessScope(actor: Actor) {
  const isPlatformAdmin = actor.roles.includes("PLATFORM_ADMIN");
  const isOperations = actor.roles.includes("OPS_MANAGER");
  const base = {
    tenantId: actor.tenantId,
    ...(!isPlatformAdmin && actor.branchId
      ? isOperations
        ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
        : { branchId: actor.branchId }
      : {}),
    ...(!isPlatformAdmin && actor.clientId ? { clientId: actor.clientId } : {}),
  };
  if (isPlatformAdmin) return base;
  if (
    actor.clientId ||
    actor.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role))
  ) {
    return base;
  }
  if (actor.roles.includes("VERIFIER")) {
    return {
      ...base,
      checks: { some: { tasks: { some: { assigneeId: actor.userId } } } },
    };
  }
  if (actor.roles.includes("QA_REVIEWER")) {
    return { ...base, qaReviewerId: actor.userId };
  }
  if (actor.roles.includes("FIELD_EXECUTIVE")) {
    return {
      ...base,
      fieldVisits: { some: { assigneeId: actor.userId } },
    };
  }
  return { ...base, id: -1n };
}
