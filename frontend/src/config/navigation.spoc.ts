import { Building2, KeyRound, LayoutDashboard, TableProperties } from "lucide-react";
import type { NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const SPOC_ROLES: readonly Role[] = ["SPOC_RM", "PLATFORM_ADMIN"];

export const SPOC_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Monitoring", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

function item(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  group: NavItem["group"] = "command",
  permission: NavItem["permission"] = "dashboard:read",
): NavItem {
  return {
    workspace: "spoc-rm",
    label,
    description,
    icon,
    route,
    group,
    roles: SPOC_ROLES,
    permission,
  };
}

export const SPOC_NAV_ITEMS: readonly NavItem[] = [
  item(
    "Monitoring overview",
    "Work, stages and exceptions across every role",
    LayoutDashboard,
    "/spoc-rm",
  ),
  item(
    "Records",
    "View-only cases, tasks, QA, visits, pipeline and invoices",
    TableProperties,
    "/spoc-rm/records",
  ),
  item("Clients", "Per-client progress, exceptions and receivables", Building2, "/spoc-rm/clients"),
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "account",
    "notification:read",
  ),
];
