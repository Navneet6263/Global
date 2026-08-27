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
  | "finance"
  | "candidate";

export interface WorkspaceDefinition {
  id: WorkspaceId;
  label: string;
  summary: string;
  basePath: string;
  roles: readonly Role[];
  requiredPermission: Permission;
  status: "available" | "planned";
}

export const WORKSPACES: readonly WorkspaceDefinition[] = [
  {
    id: "platform-admin",
    label: "Platform Admin",
    summary: "Control tower, access, policy and audit across Sapling Global.",
    basePath: "/admin",
    roles: ["PLATFORM_ADMIN"],
    requiredPermission: "dashboard:read",
    status: "available",
  },
  {
    id: "operations",
    label: "Operations Manager",
    summary: "Allocation, throughput and SLA recovery workspace.",
    basePath: "/admin/cases",
    roles: ["PLATFORM_ADMIN", "OPS_MANAGER"],
    requiredPermission: "case:assign",
    status: "planned",
  },
  {
    id: "executive",
    label: "Executive Analytics",
    summary: "Portfolio, risk and forecast analytics for leadership.",
    basePath: "/admin/analytics",
    roles: ["PLATFORM_ADMIN", "OPS_MANAGER"],
    requiredPermission: "report:read",
    status: "available",
  },
  {
    id: "verifier",
    label: "Verifier",
    summary: "Check execution queues. Detailed screens land in a later phase.",
    basePath: "/admin/verifier",
    roles: ["PLATFORM_ADMIN", "VERIFIER"],
    requiredPermission: "case:read",
    status: "planned",
  },
  {
    id: "qa",
    label: "QA Reviewer",
    summary: "Review, correction and sign-off workspace.",
    basePath: "/admin/qa",
    roles: ["PLATFORM_ADMIN", "QA_REVIEWER"],
    requiredPermission: "qa:read",
    status: "planned",
  },
  {
    id: "field",
    label: "Field Executive",
    summary: "Visit scheduling, GPS evidence and exception capture.",
    basePath: "/admin/field",
    roles: ["PLATFORM_ADMIN", "FIELD_EXECUTIVE"],
    requiredPermission: "field:read",
    status: "planned",
  },
  {
    id: "client",
    label: "Client Admin",
    summary: "Client-facing portal preview for onboarding teams.",
    basePath: "/admin/client-portal",
    roles: ["PLATFORM_ADMIN", "CLIENT_ADMIN"],
    requiredPermission: "client:read",
    status: "planned",
  },
  {
    id: "sales",
    label: "Sales & CRM",
    summary: "Revenue command, opportunity pipeline and forecast.",
    basePath: "/sales-crm",
    roles: ["PLATFORM_ADMIN", "SALES_MANAGER"],
    requiredPermission: "crm:read",
    status: "available",
  },
  {
    id: "finance",
    label: "Finance",
    summary: "Invoices, collections and revenue recognition.",
    basePath: "/admin/finance",
    roles: ["PLATFORM_ADMIN", "FINANCE_MANAGER"],
    requiredPermission: "finance:read",
    status: "planned",
  },
  {
    id: "candidate",
    label: "Candidate Portal",
    summary: "Consent, document upload and status tracking for candidates.",
    basePath: "/candidate",
    roles: [],
    requiredPermission: "case:read",
    status: "planned",
  },
];

export const ORGANISATION = {
  name: "Sapling Global",
  workspaceLabel: "Sapling Global — Verification Operations",
  timezoneLabel: "IST",
  locale: "en-IN",
} as const;
