import type { Session } from "@/lib/api/auth";

const AUTHENTICATED_ROLES: readonly string[] = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "SALES_MANAGER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "VERIFIER",
  "QA_REVIEWER",
  "FINANCE_MANAGER",
];

const accessRules: readonly { prefix: string; roles: readonly string[] }[] = [
  { prefix: "/admin", roles: ["PLATFORM_ADMIN"] },
  { prefix: "/operations", roles: ["OPS_MANAGER"] },
  { prefix: "/cases", roles: ["OPS_MANAGER"] },
  { prefix: "/sales-crm", roles: ["SALES_MANAGER"] },
  { prefix: "/client-portal", roles: ["CLIENT_ADMIN"] },
  { prefix: "/field-executive", roles: ["FIELD_EXECUTIVE"] },
  { prefix: "/verifier", roles: ["VERIFIER"] },
  { prefix: "/qa-review", roles: ["QA_REVIEWER"] },
  { prefix: "/finance", roles: ["FINANCE_MANAGER"] },
  { prefix: "/change-password", roles: AUTHENTICATED_ROLES },
];

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessWorkspace(session: Session, pathname: string): boolean {
  const normalizedPath = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  if (normalizedPath === "/") {
    return session.roles.some((role) => AUTHENTICATED_ROLES.includes(role));
  }
  const rule = accessRules.find(({ prefix }) => matchesPathPrefix(normalizedPath, prefix));
  if (!rule) return false;
  return session.roles.some((role) => rule.roles.includes(role));
}

export function homeForSession(session: Session): string {
  if (session.roles.includes("PLATFORM_ADMIN")) return "/admin";
  if (session.roles.includes("OPS_MANAGER")) return "/operations";
  if (session.roles.includes("CLIENT_ADMIN")) return "/client-portal";
  if (session.roles.includes("FIELD_EXECUTIVE")) return "/field-executive";
  if (session.roles.includes("QA_REVIEWER")) return "/qa-review";
  if (session.roles.includes("VERIFIER")) return "/verifier";
  if (session.roles.includes("SALES_MANAGER")) return "/sales-crm";
  if (session.roles.includes("FINANCE_MANAGER")) return "/finance";
  return "/";
}
