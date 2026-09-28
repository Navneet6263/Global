import { ForbiddenException } from "@nestjs/common";
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

/**
 * Read-only case scope for the SPOC-RM monitor (/spoc). Platform admins see the
 * whole tenant; a SPOC-RM sees only its assigned client (User.clientId) and fails
 * closed without one. Kept separate from caseAccessScope, which also guards writes.
 */
export function spocScope(actor: Actor) {
  if (actor.roles.includes("PLATFORM_ADMIN"))
    return { tenantId: actor.tenantId };
  if (!actor.clientId)
    throw new ForbiddenException(
      "SPOC-RM access requires an assigned client workspace",
    );
  return { tenantId: actor.tenantId, clientId: actor.clientId };
}
