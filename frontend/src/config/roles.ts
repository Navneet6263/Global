import type { Permission } from "./permissions";

export const ROLES = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
] as const;

export type Role = (typeof ROLES)[number];

export type RoleScopeField = "branch" | "clientWorkspace" | "territory" | "queue";

export interface RoleDefinition {
  id: Role;
  label: string;
  description: string;
  permissions: readonly Permission[];
  scopeFields: readonly RoleScopeField[];
  phase: "live" | "planned";
}

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  PLATFORM_ADMIN: {
    id: "PLATFORM_ADMIN",
    label: "Platform Admin",
    description:
      "Oversight of the platform: access, policy, audit and read-only delivery numbers. Case execution stays with the delivery roles.",
    permissions: [
      "dashboard:read",
      "case:read",
      "case:create",
      "client:read",
      "client:write",
      "user:read",
      "user:write",
      "settings:manage",
      "audit:read",
      "report:read",
      "finance:read",
      "crm:read",
      "crm:forecast",
      "notification:read",
      "qa:read",
      "field:read",
      "sla:read",
      "team:read",
      "security:manage",
    ],
    scopeFields: ["branch"],
    phase: "live",
  },
  OPS_MANAGER: {
    id: "OPS_MANAGER",
    label: "Operations Manager",
    description: "Owns delivery throughput, verifier allocation, exceptions and SLA recovery.",
    permissions: [
      "dashboard:read",
      "case:read",
      "case:create",
      "case:assign",
      "case:transition",
      "case:escalate",
      "clarification:manage",
      "exception:manage",
      "sla:read",
      "team:read",
      "field:read",
      "field:manage",
      "client:read",
      "report:read",
      "qa:read",
    ],
    scopeFields: ["branch", "queue"],
    phase: "live",
  },
  VERIFIER: {
    id: "VERIFIER",
    label: "Verifier",
    description: "Executes assigned identity, employment, education and reference checks.",
    permissions: ["case:read", "report:read"],
    scopeFields: ["branch", "queue"],
    phase: "planned",
  },
  QA_REVIEWER: {
    id: "QA_REVIEWER",
    label: "QA Reviewer",
    description: "Reviews completed checks, returns corrections and signs off reports.",
    permissions: ["case:read", "qa:read", "report:read"],
    scopeFields: ["branch"],
    phase: "planned",
  },
  CLIENT_ADMIN: {
    id: "CLIENT_ADMIN",
    label: "Client Admin",
    description: "Client-side workspace owner: raises cases and resolves clarifications.",
    permissions: ["case:read", "case:create", "report:read"],
    scopeFields: ["clientWorkspace"],
    phase: "planned",
  },
  FIELD_EXECUTIVE: {
    id: "FIELD_EXECUTIVE",
    label: "Field Executive",
    description: "Performs address and on-site visits with GPS-tagged evidence capture.",
    permissions: ["case:read", "field:read"],
    scopeFields: ["branch", "territory"],
    phase: "planned",
  },
  SALES_MANAGER: {
    id: "SALES_MANAGER",
    label: "Sales Manager",
    description: "Owns CRM opportunities, proposals and client onboarding pipeline.",
    permissions: [
      "dashboard:read",
      "crm:read",
      "crm:write",
      "crm:assign",
      "crm:forecast",
      "crm:export",
      "client:read",
      "notification:read",
      "report:read",
    ],
    scopeFields: ["territory"],
    phase: "live",
  },
  FINANCE_MANAGER: {
    id: "FINANCE_MANAGER",
    label: "Finance Manager",
    description: "Manages invoicing, collections and package pricing compliance.",
    permissions: ["finance:read", "client:read", "report:read"],
    scopeFields: ["branch"],
    phase: "planned",
  },
};

export const ROLE_LIST: readonly RoleDefinition[] = ROLES.map((role) => ROLE_DEFINITIONS[role]);

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_DEFINITIONS[role].permissions) set.add(permission);
  }
  return [...set];
}
