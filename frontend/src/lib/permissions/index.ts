import type { Permission } from "@/config/permissions";
import type { Role } from "@/config/roles";
import type { PlatformSession } from "@/lib/auth/session";

export function can(session: PlatformSession, permission: Permission): boolean {
  return session.permissions.includes("*") || session.permissions.includes(permission);
}

export function canAll(session: PlatformSession, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(session, permission));
}

export function canAny(session: PlatformSession, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(session, permission));
}

export function hasRole(session: PlatformSession, role: Role): boolean {
  return session.roles.includes(role);
}

export function isVisible(
  session: PlatformSession,
  requirement: { permission: Permission; roles?: readonly Role[] },
): boolean {
  if (!can(session, requirement.permission)) return false;
  if (!requirement.roles || requirement.roles.length === 0) return true;
  return requirement.roles.some((role) => session.roles.includes(role));
}
