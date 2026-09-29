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
 * The clients a SPOC-RM may touch (SpocClientScope, loaded per request). Undefined
 * means Platform Admin (whole tenant). A SPOC-RM with no client fails closed.
 */
export function spocClientIds(actor: Actor): bigint[] | undefined {
  if (actor.roles.includes("PLATFORM_ADMIN")) return undefined;
  const ids = (actor.spocClients ?? []).map((client) => client.id);
  if (!ids.length)
    throw new ForbiddenException(
      "SPOC-RM access requires an assigned client workspace",
    );
  return ids;
}

/**
 * Case scope for the SPOC-RM monitor (/spoc) and its vendor workflow. Platform
 * admins see the whole tenant; a SPOC-RM sees only its assigned clients. Kept
 * separate from caseAccessScope, which serves every other role.
 */
export function spocScope(actor: Actor) {
  const ids = spocClientIds(actor);
  return ids
    ? { tenantId: actor.tenantId, clientId: { in: ids } }
    : { tenantId: actor.tenantId };
}

/**
 * Support desk scope: the actor's whole tenant, read-only. Kept separate from
 * caseAccessScope, which still fails closed (id -1) for SUPPORT_AGENT.
 */
export function supportScope(actor: Actor) {
  return { tenantId: actor.tenantId };
}
