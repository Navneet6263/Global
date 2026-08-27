import { getSession, type Session } from "@/lib/backend-api/auth";
import { ROLES, type Role } from "@/config/roles";

export interface AuthenticatedIdentity {
  userId: string;
  email: string | null;
  fullName: string;
  roles: readonly Role[];
  permissions: readonly string[];
  branchScope: readonly string[];
  tenantName: string;
  clientName?: string;
  mustChangePassword: boolean;
}

let currentIdentity: AuthenticatedIdentity | null = null;

function asRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

function fromBackendSession(session: Session): AuthenticatedIdentity {
  return {
    userId: session.id,
    email: session.email,
    fullName: session.displayName,
    roles: session.roles.map(asRole).filter((role): role is Role => role !== null),
    permissions: session.permissions,
    branchScope: ["All branches"],
    tenantName: session.tenantName,
    clientName: session.clientName,
    mustChangePassword: session.mustChangePassword,
  };
}

export function cachedIdentity(): AuthenticatedIdentity | null {
  return currentIdentity;
}

export function clearIdentity(): void {
  currentIdentity = null;
}

export async function loadIdentity(): Promise<AuthenticatedIdentity | null> {
  try {
    currentIdentity = fromBackendSession(await getSession());
    return currentIdentity;
  } catch {
    currentIdentity = null;
    return null;
  }
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
