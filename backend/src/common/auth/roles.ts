import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "./actor";

export const OPERATIONS_ROLES = ["PLATFORM_ADMIN", "OPS_MANAGER"] as const;
/** Read-only central monitoring (/spoc). Never add SPOC_RM to a write-path role list. */
export const SPOC_ROLES = ["PLATFORM_ADMIN", "SPOC_RM"] as const;

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
