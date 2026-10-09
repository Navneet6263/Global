import type { Role } from "@/config/roles";
import type { Permission } from "@/config/permissions";
import type { WorkspaceId } from "@/config/workspaces";
import type { NavWorkspace } from "@/config/navigation";
import { cachedIdentity } from "./platform-session";

/** SPOC-RM header scope: "A", "A, B" or "A, B +1". */
function clientScopeLabel(names: readonly string[]): string {
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

export interface PlatformSession {
  userId: string;
  fullName: string;
  email: string;
  roles: readonly Role[];
  permissions: readonly (Permission | "*")[];
  branchScope: readonly string[];
  scopeLabel: string;
  /** View-only Platform Admin: write actions are hidden (the API refuses them too). */
  viewOnly?: boolean;
  activeWorkspace: WorkspaceId;
  signedInAt: string;
}

export function getSession(workspace: WorkspaceId = "platform-admin"): PlatformSession {
  const identity = cachedIdentity();
  return {
    userId: identity?.userId ?? "",
    fullName: identity?.fullName ?? "Sapling user",
    email: identity?.email ?? "",
    roles: identity?.roles ?? [],
    permissions: (identity?.permissions ?? []) as (Permission | "*")[],
    branchScope: identity?.branchScope ?? ["All branches"],
    scopeLabel: identity?.clientScope?.length
      ? `Client scope: ${clientScopeLabel(identity.clientScope)}`
      : identity?.clientName
        ? `Client scope: ${identity.clientName}`
        : identity?.branchScoping
          ? `Branch scope: ${identity.branchName ?? "All branches"}`
          : (identity?.tenantName ?? ""),
    viewOnly: identity?.viewOnly ?? false,
    activeWorkspace: workspace,
    signedInAt: new Date().toISOString(),
  };
}

export function workspaceForPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/operations")) return "operations";
  if (pathname.startsWith("/sales-crm")) return "sales";
  if (pathname.startsWith("/client-portal")) return "client";
  if (pathname.startsWith("/verifier")) return "verifier";
  if (pathname.startsWith("/qa-review")) return "qa";
  if (pathname.startsWith("/field-executive")) return "field";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/spoc-rm")) return "spoc";
  if (pathname.startsWith("/data-entry")) return "data-entry";
  if (pathname === "/vendor" || pathname.startsWith("/vendor/")) return "vendor";
  if (pathname === "/support" || pathname.startsWith("/support/")) return "support";
  return "platform-admin";
}

const NAV_TO_WORKSPACE: Record<NavWorkspace, WorkspaceId> = {
  "platform-admin": "platform-admin",
  operations: "operations",
  "sales-crm": "sales",
  "client-admin": "client",
  verifier: "verifier",
  "qa-reviewer": "qa",
  "field-executive": "field",
  finance: "finance",
  "spoc-rm": "spoc",
  vendor: "vendor",
  support: "support",
  "data-entry": "data-entry",
};

export function sessionForNav(nav: NavWorkspace): PlatformSession {
  return getSession(NAV_TO_WORKSPACE[nav]);
}
