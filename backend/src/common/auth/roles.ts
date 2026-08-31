import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "./actor";

export const OPERATIONS_ROLES = ["PLATFORM_ADMIN", "OPS_MANAGER"] as const;

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
