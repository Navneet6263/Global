import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "./actor";

export const OPERATIONS_ROLES = ["PLATFORM_ADMIN", "OPS_MANAGER"] as const;
/**
 * Central monitoring (/spoc) plus vendor assignment (/spoc/vendors). The v2 RM actions
 * live in /workflow and re-check case ownership; test/spoc-access.test.ts pins the
 * exact allow-list, so never add SPOC_RM to any other role list.
 */
export const SPOC_ROLES = ["PLATFORM_ADMIN", "SPOC_RM"] as const;
/** External vendors: only their own assigned requests (/vendor/requests). */
export const VENDOR_ROLES = ["VENDOR"] as const;
/**
 * Support desk (/support): read-only operational visibility plus the support-request
 * inbox. Never add SUPPORT_AGENT to a case, document, user, finance or CRM role list.
 */
/** Intake review (/workflow/data-entry): only cases assigned to the user or its team. */
export const DATA_ENTRY_ROLES = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "DATA_ENTRY",
] as const;
export const SUPPORT_ROLES = ["PLATFORM_ADMIN", "SUPPORT_AGENT"] as const;

export function hasAnyRole(actor: Actor, allowed: readonly string[]): boolean {
  return actor.roles.some((role) => allowed.includes(role));
}

export function assertAnyRole(
  actor: Actor,
  allowed: readonly string[],
  message = "This role cannot perform the requested action",
): void {
  if (!hasAnyRole(actor, allowed)) throw new ForbiddenException(message);
}
