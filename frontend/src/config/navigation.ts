import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Building2,
  ClipboardList,
  FileSearch,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Receipt,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Permission } from "./permissions";
import { CRM_NAV_GROUPS, CRM_NAV_ITEMS } from "./navigation.crm";
import type { Role } from "./roles";

export type NavGroupId =
  "command" | "delivery" | "stakeholders" | "platform" | "revenue" | "work" | "account";

export interface NavGroup {
  id: NavGroupId;
  label: string;
  defaultOpen: boolean;
}

export type NavBadgeTone = "info" | "warning" | "critical" | "review" | "neutral";

export type NavWorkspace = "platform-admin" | "operations" | "sales-crm";

export interface NavItem {
  workspace: NavWorkspace;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
  group: NavGroupId;
  roles: readonly Role[];
  permission: Permission;
  badge?: { key: string; tone: NavBadgeTone };
  featureFlag?: string;
  phase: "live" | "planned";
}

export const OPS_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Command", defaultOpen: true },
  { id: "delivery", label: "Delivery", defaultOpen: true },
  { id: "stakeholders", label: "People", defaultOpen: true },
];

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Command", defaultOpen: true },
  { id: "delivery", label: "Delivery", defaultOpen: true },
  { id: "stakeholders", label: "Stakeholders", defaultOpen: true },
  { id: "platform", label: "Platform", defaultOpen: true },
];

const ADMIN: readonly Role[] = ["PLATFORM_ADMIN"];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    workspace: "platform-admin",
    label: "Control Tower",
    description: "Live portfolio, SLA health and exceptions",
    icon: LayoutDashboard,
    route: "/admin",
    group: "command",
    roles: ADMIN,
    permission: "dashboard:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Executive Analytics",
    description: "Trends, risk mix and 7-day forecast",
    icon: TrendingUp,
    route: "/admin/analytics",
    group: "command",
    roles: ADMIN,
    permission: "report:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Sales & CRM",
    description: "Revenue oversight (read-only)",
    icon: Gauge,
    route: "/admin/sales",
    group: "command",
    roles: [...ADMIN, "SALES_MANAGER"],
    permission: "crm:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Cases & Delivery",
    description: "Verification register",
    icon: ClipboardList,
    route: "/admin/cases",
    group: "delivery",
    roles: [...ADMIN, "OPS_MANAGER"],
    permission: "case:read",
    badge: { key: "activeCases", tone: "info" },
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Verifier Operations",
    description: "Allocation and verifier load",
    icon: BadgeCheck,
    route: "/admin/verifier",
    group: "delivery",
    roles: [...ADMIN, "VERIFIER"],
    permission: "team:read",
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "QA Review",
    description: "Review and sign-off queue",
    icon: FileSearch,
    route: "/admin/qa",
    group: "delivery",
    roles: [...ADMIN, "QA_REVIEWER"],
    permission: "qa:read",
    badge: { key: "qaQueue", tone: "review" },
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "Exceptions",
    description: "Blocked and at-risk work",
    icon: LifeBuoy,
    route: "/admin/exceptions",
    group: "delivery",
    roles: ADMIN,
    permission: "case:read",
    badge: { key: "criticalExceptions", tone: "critical" },
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "Field Operations",
    description: "Visits, GPS and evidence",
    icon: MapPin,
    route: "/admin/field",
    group: "delivery",
    roles: [...ADMIN, "FIELD_EXECUTIVE"],
    permission: "field:read",
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "Clients",
    description: "Client organisations and SLAs",
    icon: Building2,
    route: "/admin/clients",
    group: "stakeholders",
    roles: ADMIN,
    permission: "client:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Client Portal Preview",
    description: "See what clients see",
    icon: Activity,
    route: "/admin/client-portal",
    group: "stakeholders",
    roles: [...ADMIN, "CLIENT_ADMIN"],
    permission: "client:read",
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "Finance & Billing",
    description: "Invoices and collections",
    icon: Receipt,
    route: "/admin/finance",
    group: "stakeholders",
    roles: [...ADMIN, "FINANCE_MANAGER"],
    permission: "finance:read",
    phase: "planned",
  },
  {
    workspace: "platform-admin",
    label: "User IDs & Access",
    description: "Roles, scope and credentials",
    icon: Users,
    route: "/admin/users",
    group: "platform",
    roles: ADMIN,
    permission: "user:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Platform Settings",
    description: "Branches, packages and policy",
    icon: Settings2,
    route: "/admin/settings",
    group: "platform",
    roles: ADMIN,
    permission: "settings:manage",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Audit Trail",
    description: "Immutable platform activity",
    icon: ShieldCheck,
    route: "/admin/audit",
    group: "platform",
    roles: ADMIN,
    permission: "audit:read",
    phase: "live",
  },
  {
    workspace: "platform-admin",
    label: "Account Security",
    description: "Sessions and auth events",
    icon: KeyRound,
    route: "/admin/security",
    group: "platform",
    roles: ADMIN,
    permission: "security:manage",
    phase: "live",
  },
];

const OPS: readonly Role[] = ["OPS_MANAGER"];

export const OPS_NAV_ITEMS: readonly NavItem[] = [
  {
    workspace: "operations",
    label: "Operations Dashboard",
    description: "Workload, stage flow and today's action queue",
    icon: LayoutDashboard,
    route: "/operations",
    group: "command",
    roles: OPS,
    permission: "dashboard:read",
    phase: "live",
  },
  {
    workspace: "operations",
    label: "SLA Monitor",
    description: "Breach risk, ageing and bottlenecks",
    icon: Gauge,
    route: "/operations/sla",
    group: "command",
    roles: OPS,
    permission: "sla:read",
    badge: { key: "opsSlaRisk", tone: "warning" },
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Case 360",
    description: "Every case with full delivery context",
    icon: ClipboardList,
    route: "/operations/cases",
    group: "delivery",
    roles: OPS,
    permission: "case:read",
    badge: { key: "opsActiveCases", tone: "info" },
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Assignment Workbench",
    description: "Allocate unassigned checks to verifiers",
    icon: BadgeCheck,
    route: "/operations/assignments",
    group: "delivery",
    roles: OPS,
    permission: "case:assign",
    badge: { key: "opsUnassigned", tone: "critical" },
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Exceptions",
    description: "Blocked, breached and returned work",
    icon: LifeBuoy,
    route: "/operations/exceptions",
    group: "delivery",
    roles: OPS,
    permission: "exception:manage",
    badge: { key: "opsExceptions", tone: "critical" },
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Clarifications",
    description: "Candidate and client follow-ups",
    icon: FileSearch,
    route: "/operations/clarifications",
    group: "delivery",
    roles: OPS,
    permission: "clarification:manage",
    badge: { key: "opsClarifications", tone: "review" },
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Field Operations",
    description: "Visits, geofence and evidence review",
    icon: MapPin,
    route: "/operations/field",
    group: "delivery",
    roles: OPS,
    permission: "field:manage",
    phase: "live",
  },
  {
    workspace: "operations",
    label: "Team Capacity",
    description: "Verifier load, skills and availability",
    icon: Users,
    route: "/operations/team",
    group: "stakeholders",
    roles: OPS,
    permission: "team:read",
    phase: "live",
  },
];

export function navFor(workspace: NavWorkspace): {
  groups: readonly NavGroup[];
  items: readonly NavItem[];
} {
  if (workspace === "operations") return { groups: OPS_NAV_GROUPS, items: OPS_NAV_ITEMS };
  if (workspace === "sales-crm") return { groups: CRM_NAV_GROUPS, items: CRM_NAV_ITEMS };
  return { groups: NAV_GROUPS, items: NAV_ITEMS };
}
