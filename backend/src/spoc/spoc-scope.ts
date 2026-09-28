import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { spocScope } from "../common/auth/access-scope";
import type { SpocScopeQueryDto } from "./dto/spoc-query.dto";

/** Tenant-wide case filter plus the optional client / branch / priority filters. */
export function spocCaseWhere(actor: Actor, query: SpocScopeQueryDto) {
  return {
    ...spocScope(actor),
    ...(query.clientId ? { client: { publicId: query.clientId } } : {}),
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
 * The one place a request's client filter is decided. A SPOC-RM is pinned to its
 * assigned client: a missing clientId defaults to it and any other client is
 * refused (URL / query / API manipulation). Platform admins may pick any client.
 */
export function enforceSpocClient<T extends { clientId?: string }>(
  actor: Actor,
  query: T,
): T {
  if (actor.roles.includes("PLATFORM_ADMIN")) return query;
  const own = actor.clientPublicId?.toLowerCase();
  if (!own)
    throw new ForbiddenException(
      "SPOC-RM access requires an assigned client workspace",
    );
  if (query.clientId && query.clientId.toLowerCase() !== own)
    throw new ForbiddenException("This client is outside your SPOC-RM scope");
  query.clientId = own;
  return query;
}
