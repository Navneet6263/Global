import { redirect } from "@tanstack/react-router";
import type { Role } from "@/config/roles";
import { landingPathForRoles, loadIdentity } from "./platform-session";

export async function requireRoleWorkspace(
  allowedRoles: readonly Role[],
  options: { reloadOnDenied?: boolean } = {},
) {
  const identity = await loadIdentity();
  if (!identity) throw redirect({ to: "/auth" });
  if (identity.mustChangePassword) throw redirect({ to: "/change-password" });

  const allowed = identity.roles.some((role) => allowedRoles.includes(role));
  if (!allowed) {
    // A denied client-only entry must not hydrate a different workspace's shell.
    throw redirect({
      to: landingPathForRoles(identity.roles) as "/admin",
      ...(options.reloadOnDenied ? { reloadDocument: true } : {}),
    });
  }
  return identity;
}

export async function requirePasswordChangeSession() {
  const identity = await loadIdentity();
  if (!identity) throw redirect({ to: "/auth" });
  return identity;
}
