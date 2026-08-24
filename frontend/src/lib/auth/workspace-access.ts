import type { Session } from "@/lib/api/auth";

const accessByPath: Record<string, string[]> = {
  "/": ["PLATFORM_ADMIN", "OPS_MANAGER"],
  "/executive": ["PLATFORM_ADMIN", "OPS_MANAGER"],
  "/sales-crm": ["PLATFORM_ADMIN", "SALES_MANAGER"],
  "/verifier": ["PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER"],
  "/qa-review": ["PLATFORM_ADMIN", "OPS_MANAGER", "QA_REVIEWER"],
  "/exceptions": ["PLATFORM_ADMIN", "OPS_MANAGER"],
  "/client-portal": ["PLATFORM_ADMIN", "CLIENT_ADMIN"],
  "/field-executive": ["PLATFORM_ADMIN", "OPS_MANAGER", "FIELD_EXECUTIVE"],
  "/finance": ["PLATFORM_ADMIN", "FINANCE_MANAGER"],
  "/settings": ["PLATFORM_ADMIN", "OPS_MANAGER"],
};

export function canAccessWorkspace(session: Session, pathname: string): boolean {
  if (pathname.startsWith("/cases/")) {
    return session.permissions.includes("*") || session.permissions.includes("case:read");
  }
  const required = accessByPath[pathname];
  if (!required) return true;
  return session.roles.some((role) => required.includes(role));
}

export function homeForSession(session: Session): string {
  if (session.roles.includes("CLIENT_ADMIN")) return "/client-portal";
  if (session.roles.includes("FIELD_EXECUTIVE")) return "/field-executive";
  if (session.roles.includes("QA_REVIEWER")) return "/qa-review";
  if (session.roles.includes("VERIFIER")) return "/verifier";
  if (session.roles.includes("SALES_MANAGER")) return "/sales-crm";
  if (session.roles.includes("FINANCE_MANAGER")) return "/finance";
  return "/";
}
