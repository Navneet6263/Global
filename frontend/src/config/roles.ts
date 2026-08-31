import { PERMISSIONS, type Permission } from "./permissions";

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
}

const definitions: Record<Role, Omit<RoleDefinition, "id">> = {
  PLATFORM_ADMIN: {
    label: "Platform Admin",
    description: "Platform oversight, policy, access, audit and cross-workspace risk.",
    permissions: PERMISSIONS,
    scopeFields: [],
  },
  OPS_MANAGER: {
    label: "Operations Manager",
    description: "Owns delivery, allocation, exceptions and SLA recovery.",
    permissions: [
      "dashboard:read",
      "client:read",
      "case:read",
      "case:create",
      "case:transition",
      "consent:manage",
      "document:read",
      "document:write",
      "task:read",
      "task:write",
      "clarification:read",
      "clarification:write",
      "report:read",
      "field-visit:read",
      "field-visit:write",
      "field-evidence:read",
      "user:read",
      "notification:read",
    ],
    scopeFields: ["branch", "queue"],
  },
  VERIFIER: {
    label: "Verifier",
    description: "Executes assigned checks, findings and source verification.",
    permissions: [
      "dashboard:read",
      "case:read",
      "document:read",
      "task:read",
      "task:write",
      "clarification:read",
      "clarification:write",
      "notification:read",
    ],
    scopeFields: ["branch", "queue"],
  },
  QA_REVIEWER: {
    label: "QA Reviewer",
    description: "Reviews evidence, returns rework and releases approved reports.",
    permissions: [
      "dashboard:read",
      "case:read",
      "document:read",
      "clarification:read",
      "qa:review",
      "report:read",
      "report:generate",
      "field-evidence:read",
      "notification:read",
    ],
    scopeFields: ["branch"],
  },
  CLIENT_ADMIN: {
    label: "Client Admin",
    description: "Raises client-scoped cases and resolves requested actions.",
    permissions: [
      "dashboard:read",
      "case:read",
      "case:create",
      "document:read",
      "document:write",
      "clarification:read",
      "report:read",
      "notification:read",
    ],
    scopeFields: ["clientWorkspace"],
  },
  FIELD_EXECUTIVE: {
    label: "Field Executive",
    description: "Completes assigned visits with GPS and integrity-checked evidence.",
    permissions: [
      "case:read",
      "field-visit:read",
      "field-visit:write",
      "field-evidence:read",
      "notification:read",
    ],
    scopeFields: ["branch", "territory"],
  },
  SALES_MANAGER: {
    label: "Sales Manager",
    description: "Owns opportunities, activities and client onboarding pipeline.",
    permissions: [
      "dashboard:read",
      "client:read",
      "client:write",
      "crm:read",
      "crm:write",
      "notification:read",
    ],
    scopeFields: ["territory"],
  },
  FINANCE_MANAGER: {
    label: "Finance Manager",
    description: "Manages invoicing, collections, credits and receivables.",
    permissions: [
      "dashboard:read",
      "client:read",
      "finance:read",
      "finance:write",
      "notification:read",
    ],
    scopeFields: ["branch"],
  },
};

export const ROLE_DEFINITIONS = Object.fromEntries(
  ROLES.map((id) => [id, { id, ...definitions[id] }]),
) as Record<Role, RoleDefinition>;

export const ROLE_LIST: readonly RoleDefinition[] = ROLES.map((role) => ROLE_DEFINITIONS[role]);

export function permissionsForRoles(roles: readonly Role[]): Permission[] {
  return [...new Set(roles.flatMap((role) => ROLE_DEFINITIONS[role].permissions))];
}
