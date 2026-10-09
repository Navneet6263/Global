import { FileSpreadsheet, KeyRound, LayoutDashboard, ListChecks } from "lucide-react";
import type { NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const DATA_ENTRY: readonly Role[] = ["DATA_ENTRY"];

export const DATA_ENTRY_NAV_GROUPS: readonly NavGroup[] = [
  { id: "work", label: "Work", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

function item(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  group: NavItem["group"],
  permission: NavItem["permission"],
): NavItem {
  return {
    workspace: "data-entry",
    label,
    description,
    icon,
    route,
    group,
    roles: DATA_ENTRY,
    permission,
  };
}

export const DATA_ENTRY_NAV_ITEMS: readonly NavItem[] = [
  item(
    "Dashboard",
    "Your queue, work done and turnaround",
    LayoutDashboard,
    "/data-entry/overview",
    "work",
    "case:read",
  ),
  item(
    "Intake queue",
    "Completeness review, corrections and Ready",
    ListChecks,
    "/data-entry",
    "work",
    "case:read",
  ),
  item(
    "My reports",
    "Custom sheet of your work for any period",
    FileSpreadsheet,
    "/data-entry/reports",
    "work",
    "case:read",
  ),
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "account",
    "notification:read",
  ),
];
