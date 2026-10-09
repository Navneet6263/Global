import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "./actor";
import type { Prisma } from "../../generated/prisma/client";

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
  const ledDepartments = (actor.departments ?? [])
    .filter((department) => department.role === "LEAD")
    .map((department) => department.id);
  // One clause per working role; a person with several roles (e.g. RM + Data Entry)
  // sees the cases of each role, never more.
  const clauses: Prisma.VerificationCaseWhereInput[] = [];
  if (actor.roles.includes("VERIFIER")) {
    const assigned = {
      checks: { some: { tasks: { some: { assigneeId: actor.userId } } } },
    };
    // A Team Leader also works every case routed to a department it leads.
    clauses.push(
      ledDepartments.length
        ? {
            OR: [
              assigned,
              { checks: { some: { departmentId: { in: ledDepartments } } } },
            ],
          }
        : assigned,
    );
  }
  if (actor.roles.includes("DATA_ENTRY")) {
    // Members see their assigned intake; a Data Entry lead sees its whole team's intake.
    clauses.push(
      ledDepartments.length
        ? {
            workflowVersion: 2,
            OR: [
              { dataEntryUserId: actor.userId },
              {
                dataEntryUser: {
                  departmentMemberships: {
                    some: { departmentId: { in: ledDepartments } },
                  },
                },
              },
            ],
          }
        : { workflowVersion: 2, dataEntryUserId: actor.userId },
    );
  }
  if (actor.roles.includes("SPOC_RM")) {
    // RM works the cases of its mapped clients; owner-only actions are checked per action.
    const clients = (actor.spocClients ?? []).map((client) => client.id);
    clauses.push({ clientId: { in: clients.length ? clients : [-1n] } });
  }
  if (actor.roles.includes("QA_REVIEWER")) {
    clauses.push({ qaReviewerId: actor.userId });
  }
  if (actor.roles.includes("FIELD_EXECUTIVE")) {
    clauses.push({ fieldVisits: { some: { assigneeId: actor.userId } } });
  }
  if (!clauses.length) return { ...base, id: -1n };
  if (clauses.length === 1) return { ...base, ...clauses[0] };
  return { ...base, AND: [{ OR: clauses }] };
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
