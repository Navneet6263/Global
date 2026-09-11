import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Files,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  MessageSquareWarning,
  ReceiptIndianRupee,
  ScrollText,
  TimerReset,
} from "lucide-react";
import type { NavGroup, NavItem, NavWorkspace, WorkspaceNavigation } from "./navigation.types";
import type { Role } from "./roles";
import { QA_FINANCE_NAVIGATION } from "./navigation.qa-finance";

const ROLE_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Workspace", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

const VERIFIER_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Workspace", defaultOpen: true },
  { id: "work", label: "History & insights", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

function roleNav(
  workspace: NavWorkspace,
  role: Role,
  label: string,
  description: string,
  route: string,
  icon: NavItem["icon"],
  permission: NavItem["permission"],
): WorkspaceNavigation {
  const roles: readonly Role[] = [role];
  return {
    groups: ROLE_GROUPS,
    items: [
      {
        workspace,
        label,
        description,
        icon,
        route,
        group: "command",
        roles,
        permission,
      },
      {
        workspace,
        label: "Account Security",
        description: "Password, sessions and sign-in activity",
        icon: KeyRound,
        route: "/change-password",
        group: "account",
        roles,
        permission: "notification:read",
      },
    ],
  };
}

export const ROLE_NAVIGATION: Partial<Record<NavWorkspace, WorkspaceNavigation>> = {
  "client-admin": {
    groups: ROLE_GROUPS,
    items: [
      clientItem(
        "Portfolio overview",
        "Live volume, SLA and verification flow",
        LayoutDashboard,
        "/client-portal",
        "dashboard:read",
      ),
      clientItem(
        "Verifications",
        "Search and monitor every candidate case",
        Files,
        "/client-portal/verifications",
        "case:read",
      ),
      clientItem(
        "Action required",
        "Document corrections and information requests",
        BellRing,
        "/client-portal/actions",
        "case:read",
        { key: "clientActions", tone: "warning" },
      ),
      clientItem(
        "Reports",
        "Published signed verification reports",
        ScrollText,
        "/client-portal/reports",
        "report:read",
      ),
      clientItem(
        "Portfolio analytics",
        "Stage ageing, outcome and rejection hotspots",
        BarChart3,
        "/client-portal/analytics",
        "dashboard:read",
      ),
      clientItem(
        "Invoices & payments",
        "Invoices, received payments and outstanding balances",
        ReceiptIndianRupee,
        "/client-portal/billing",
        "case:read",
      ),
      {
        workspace: "client-admin",
        label: "Account Security",
        description: "Password, sessions and sign-in activity",
        icon: KeyRound,
        route: "/change-password",
        group: "account",
        roles: ["CLIENT_ADMIN"],
        permission: "notification:read",
      },
    ],
  },
  verifier: {
    groups: VERIFIER_GROUPS,
    items: [
      verifierItem(
        "Verifier overview",
        "Today’s workload and execution health",
        LayoutDashboard,
        "/verifier",
      ),
      verifierItem(
        "Active queue",
        "Source checks, evidence and findings",
        ListChecks,
        "/verifier/queue",
        {
          key: "verifierActive",
          tone: "info",
        },
      ),
      verifierItem(
        "SLA & priorities",
        "Due-soon and overdue assignments",
        TimerReset,
        "/verifier/sla",
        {
          key: "verifierOverdue",
          tone: "critical",
        },
      ),
      verifierItem(
        "Blockers & clarifications",
        "Resolve dependencies without losing context",
        MessageSquareWarning,
        "/verifier/blockers",
        { key: "verifierBlocked", tone: "warning" },
      ),
      verifierItem(
        "Completed checks",
        "Searchable outcome and hand-off history",
        History,
        "/verifier/history",
        undefined,
        "work",
      ),
      verifierItem(
        "My performance",
        "SLA quality and throughput trends",
        Gauge,
        "/verifier/performance",
        undefined,
        "work",
      ),
      {
        workspace: "verifier",
        label: "Account Security",
        description: "Password, sessions and sign-in activity",
        icon: KeyRound,
        route: "/change-password",
        group: "account",
        roles: ["VERIFIER"],
        permission: "notification:read",
      },
    ],
  },
  "qa-reviewer": QA_FINANCE_NAVIGATION["qa-reviewer"]!,
  "field-executive": roleNav(
    "field-executive",
    "FIELD_EXECUTIVE",
    "My Field Route",
    "Visits, GPS and evidence capture",
    "/field-executive",
    MapPinned,
    "field-visit:read",
  ),
  finance: QA_FINANCE_NAVIGATION.finance!,
};

export const ROLE_WORKSPACE_ICON = BriefcaseBusiness;

function clientItem(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  permission: NavItem["permission"],
  badge?: NavItem["badge"],
): NavItem {
  return {
    workspace: "client-admin",
    label,
    description,
    icon,
    route,
    group: "command",
    roles: ["CLIENT_ADMIN"],
    permission,
    ...(badge ? { badge } : {}),
  };
}

function verifierItem(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  badge?: NavItem["badge"],
  group: NavItem["group"] = "command",
): NavItem {
  return {
    workspace: "verifier",
    label,
    description,
    icon,
    route,
    group,
    roles: ["VERIFIER"],
    permission: "task:read",
    ...(badge ? { badge } : {}),
  };
}
