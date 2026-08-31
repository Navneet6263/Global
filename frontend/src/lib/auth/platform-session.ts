import { getSession, type Session } from "@/lib/backend-api/auth";
import { registerSessionExpiryHandler } from "@/lib/backend-api/client";
import { ROLES, type Role } from "@/config/roles";
import { clearDeviceOfflineData, prepareDeviceOfflineData } from "./device-offline-data";
import {
  createDeviceDataScope,
  deviceDataScopeStorageKey,
  type DeviceDataScope,
} from "./device-data-scope";

export interface AuthenticatedIdentity {
  userId: string;
  tenantId: string;
  deviceDataScope: DeviceDataScope;
  email: string | null;
  fullName: string;
  roles: readonly Role[];
  permissions: readonly string[];
  branchScope: readonly string[];
  tenantName: string;
  branchId?: string;
  branchName?: string;
  clientName?: string;
  mustChangePassword: boolean;
}

let currentIdentity: AuthenticatedIdentity | null = null;
let identityLoad: Promise<AuthenticatedIdentity | null> | null = null;

function asRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

function fromBackendSession(session: Session): AuthenticatedIdentity {
  return {
    userId: session.id,
    tenantId: session.tenantId,
    deviceDataScope: createDeviceDataScope(session.tenantId, session.id),
    email: session.email,
    fullName: session.displayName,
    roles: session.roles.map(asRole).filter((role): role is Role => role !== null),
    permissions: session.permissions,
    branchScope: session.branchName ? [session.branchName] : ["All branches"],
    tenantName: session.tenantName,
    branchId: session.branchId,
    branchName: session.branchName,
    clientName: session.clientName,
    mustChangePassword: session.mustChangePassword,
  };
}

export function cachedIdentity(): AuthenticatedIdentity | null {
  return currentIdentity;
}

export async function cacheIdentityFromSession(session: Session): Promise<AuthenticatedIdentity> {
  const identity = fromBackendSession(session);
  currentIdentity = null;
  await prepareDeviceOfflineData(identity.deviceDataScope);
  currentIdentity = identity;
  return identity;
}

export function clearIdentity(): void {
  currentIdentity = null;
}

export async function loadIdentity(): Promise<AuthenticatedIdentity | null> {
  if (currentIdentity) return currentIdentity;
  if (!identityLoad) {
    identityLoad = getSession()
      .then(cacheIdentityFromSession)
      .catch(() => {
        currentIdentity = null;
        return null;
      })
      .finally(() => {
        identityLoad = null;
      });
  }
  return identityLoad;
}

registerSessionExpiryHandler(async () => {
  try {
    await clearDeviceOfflineData();
  } finally {
    clearIdentity();
  }
  if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
    window.location.assign("/auth");
  }
});

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (
      event.key !== deviceDataScopeStorageKey ||
      !currentIdentity ||
      event.newValue === currentIdentity.deviceDataScope
    ) {
      return;
    }
    clearIdentity();
    if (window.location.pathname !== "/auth") window.location.assign("/auth");
  });
}

export function landingPathForRoles(roles: readonly Role[]): string {
  if (roles.includes("PLATFORM_ADMIN")) return "/admin";
  if (roles.includes("OPS_MANAGER")) return "/operations";
  if (roles.includes("SALES_MANAGER")) return "/sales-crm";
  if (roles.includes("CLIENT_ADMIN")) return "/client-portal";
  if (roles.includes("FIELD_EXECUTIVE")) return "/field-executive";
  if (roles.includes("VERIFIER")) return "/verifier";
  if (roles.includes("QA_REVIEWER")) return "/qa-review";
  if (roles.includes("FINANCE_MANAGER")) return "/finance";
  return "/auth";
}

export async function resolveLandingPath(): Promise<string> {
  const identity = await loadIdentity();
  return landingPathForRoles(identity?.roles ?? []);
}

export async function requireWorkspace(
  workspace: "platform-admin" | "operations" | "sales-crm",
): Promise<AuthenticatedIdentity> {
  const identity = await loadIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");
  if (identity.roles.includes("PLATFORM_ADMIN")) return identity;
  const allowed =
    (workspace === "operations" && identity.roles.includes("OPS_MANAGER")) ||
    (workspace === "sales-crm" && identity.roles.includes("SALES_MANAGER"));
  if (!allowed) throw new Error("FORBIDDEN");
  return identity;
}

export function toE164(mobile: string): string {
  const digits = mobile.replace(/\D/g, "").replace(/^0+/, "");
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${local}`;
}
