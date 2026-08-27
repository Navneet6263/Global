import type { Role } from "@/config/roles";
import type { Permission } from "@/config/permissions";
import type { WorkspaceId } from "@/config/workspaces";
import { cachedIdentity } from "./platform-session";

export interface PlatformSession {
  userId: string;
  fullName: string;
  email: string;
  roles: readonly Role[];
  permissions: readonly (Permission | "*")[];
  branchScope: readonly string[];
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
    activeWorkspace: workspace,
    signedInAt: new Date().toISOString(),
  };
}

export function workspaceForPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/operations")) return "operations";
  if (pathname.startsWith("/sales-crm")) return "sales";
  return "platform-admin";
}

export function sessionForNav(nav: "platform-admin" | "operations" | "sales-crm"): PlatformSession {
  if (nav === "operations") return getSession("operations");
  if (nav === "sales-crm") return getSession("sales");
  return getSession("platform-admin");
}
