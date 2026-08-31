import type { Role } from "./roles";
import type { Permission } from "./permissions";

export type WorkspaceId =
  | "platform-admin"
  | "operations"
  | "executive"
  | "verifier"
  | "qa"
  | "field"
  | "client"
  | "sales"
  | "finance";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  summary: string;
  basePath: string;
  roles: readonly Role[];
  requiredPermission: Permission;
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  {
    id: "platform-admin",
    label: "Platform Admin",
    summary: "Control tower, access, policy and audit across Sapling Global.",
    basePath: "/admin",
    roles: ["PLATFORM_ADMIN"],
    requiredPermission: "dashboard:read",
  },
  {
    id: "operations",
    label: "Operations Manager",
    summary: "Allocation, throughput and SLA recovery workspace.",
    basePath: "/operations",
    roles: ["OPS_MANAGER"],
    requiredPermission: "task:write",
  },
  {
    id: "executive",
    label: "Executive Analytics",
    summary: "Portfolio, risk and forecast analytics for leadership.",
    basePath: "/admin/analytics",
    roles: ["PLATFORM_ADMIN"],
    requiredPermission: "report:read",
  },
  {
    id: "verifier",
    label: "Verifier",
    summary: "Assigned checks, findings and source verification.",
    basePath: "/verifier",
    roles: ["VERIFIER"],
    requiredPermission: "case:read",
  },
  {
    id: "qa",
    label: "QA Reviewer",
    summary: "Review, correction and sign-off workspace.",
    basePath: "/qa-review",
    roles: ["QA_REVIEWER"],
    requiredPermission: "qa:review",
  },
  {
    id: "field",
    label: "Field Executive",
    summary: "Visit scheduling, GPS evidence and exception capture.",
    basePath: "/field-executive",
    roles: ["FIELD_EXECUTIVE"],
    requiredPermission: "field-visit:read",
  },
  {
    id: "client",
    label: "Client Admin",
    summary: "Client-scoped case intake, actions and reports.",
    basePath: "/client-portal",
    roles: ["CLIENT_ADMIN"],
    requiredPermission: "case:read",
  },
  {
    id: "sales",
    label: "Sales & CRM",
    summary: "Revenue command, opportunity pipeline and forecast.",
    basePath: "/sales-crm",
    roles: ["SALES_MANAGER"],
    requiredPermission: "crm:read",
  },
  {
    id: "finance",
    label: "Finance",
    summary: "Invoices, collections and revenue recognition.",
    basePath: "/finance",
    roles: ["FINANCE_MANAGER"],
    requiredPermission: "finance:read",
  },
];

export const ORGANISATION = {
  name: "Sapling Global",
  workspaceLabel: "Sapling Global — Verification Operations",
  timezoneLabel: "IST",
  locale: "en-IN",
} as const;
