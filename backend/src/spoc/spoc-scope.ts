import { ForbiddenException } from "@nestjs/common";
import type { Actor, SpocClient } from "../common/auth/actor";
import { spocClientIds } from "../common/auth/access-scope";
import type { SpocScopeQueryDto } from "./dto/spoc-query.dto";

/** Where fragments for one request's client scope. */
export interface SpocClientFilters {
  /** Rows that carry a clientId: cases, opportunities, invoices, vendor assignments. */
  byClient:
    | { clientId: { in: bigint[] } }
    | { client: { publicId: string } }
    | Record<string, never>;
  /** Client rows themselves. */
  clientRow:
    { id: { in: bigint[] } } | { publicId: string } | Record<string, never>;
}

function assignedClient(actor: Actor, requested: string): SpocClient {
  const wanted = requested.toLowerCase();
  const match = actor.spocClients?.find(
    (client) => client.publicId.toLowerCase() === wanted,
  );
  if (!match)
    throw new ForbiddenException("This client is outside your SPOC-RM scope");
  return match;
}

/**
 * The one place a SPOC request's client scope is decided. A SPOC-RM always gets
 * `IN (assigned clients)`, narrowed to the requested client only when that client
 * is assigned (anything else is 403). No filter means all assigned clients, never
 * the whole tenant. Platform admins keep the whole tenant or the chosen client.
 */
export function resolveSpocClients(
  actor: Actor,
  requestedClientId?: string,
): SpocClientFilters {
  const assigned = spocClientIds(actor);
  if (!assigned)
    return requestedClientId
      ? {
          byClient: { client: { publicId: requestedClientId } },
          clientRow: { publicId: requestedClientId },
        }
      : { byClient: {}, clientRow: {} };
  const ids = requestedClientId
    ? [assignedClient(actor, requestedClientId).id]
    : assigned;
  return {
    byClient: { clientId: { in: ids } },
    clientRow: { id: { in: ids } },
  };
}

/** Case filter: client scope plus the optional branch / priority filters. */
export function spocCaseWhere(actor: Actor, query: SpocScopeQueryDto) {
  return {
    tenantId: actor.tenantId,
    ...resolveSpocClients(actor, query.clientId).byClient,
    ...(query.branchId ? { branch: { publicId: query.branchId } } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
  };
}

export function paging(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return { items, total, page, pageSize };
}

/** Completed-work windows default to the last 30 days. */
export function spocRange(query: { from?: string; to?: string }, now: Date) {
  const to = query.to ? new Date(query.to) : now;
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 86_400_000);
  return from > to ? { from: to, to: from } : { from, to };
}

/**
 * First gate in every /spoc handler: refuses a client outside the SPOC-RM's
 * assigned clients (URL / query / API manipulation) and a SPOC-RM with no client.
 * It never rewrites the filter; services apply the scope via resolveSpocClients.
 */
export function enforceSpocClient<T extends { clientId?: string }>(
  actor: Actor,
  query: T,
): T {
  resolveSpocClients(actor, query.clientId);
  return query;
}
