import {
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  MapPinned,
  ReceiptIndianRupee,
} from "lucide-react";
import type { NavGroup, NavItem, NavWorkspace, WorkspaceNavigation } from "./navigation.types";
import type { Role } from "./roles";

const ROLE_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Workspace", defaultOpen: true },
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
  "client-admin": roleNav(
    "client-admin",
    "CLIENT_ADMIN",
    "Verification Portfolio",
    "Cases, actions and completed reports",
    "/client-portal",
    LayoutDashboard,
    "case:read",
  ),
  verifier: roleNav(
    "verifier",
    "VERIFIER",
    "Verification Workbench",
    "Assigned checks, evidence and findings",
    "/verifier",
    ClipboardCheck,
    "task:read",
  ),
  "qa-reviewer": roleNav(
    "qa-reviewer",
    "QA_REVIEWER",
    "Independent QA Review",
    "Evidence review, rework and approval",
    "/qa-review",
    FileCheck2,
    "qa:review",
  ),
  "field-executive": roleNav(
    "field-executive",
    "FIELD_EXECUTIVE",
    "My Field Route",
    "Visits, GPS and evidence capture",
    "/field-executive",
    MapPinned,
    "field-visit:read",
  ),
  finance: roleNav(
    "finance",
    "FINANCE_MANAGER",
    "Revenue Control",
    "Invoices, collections and credits",
    "/finance",
    ReceiptIndianRupee,
    "finance:read",
  ),
};

export const ROLE_WORKSPACE_ICON = BriefcaseBusiness;
