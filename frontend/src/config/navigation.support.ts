import { Building2, Inbox, KeyRound, Users } from "lucide-react";
import type { NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const SUPPORT_ROLES: readonly Role[] = ["SUPPORT_AGENT", "PLATFORM_ADMIN"];

export const SUPPORT_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Support desk", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

function item(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  permission: NavItem["permission"],
  group: NavItem["group"] = "command",
): NavItem {
  return {
    workspace: "support",
    label,
    description,
    icon,
    route,
    group,
    roles: SUPPORT_ROLES,
    permission,
  };
}

export const SUPPORT_NAV_ITEMS: readonly NavItem[] = [
  item(
    "Clients",
    "Each client's employees, progress and exceptions",
    Building2,
    "/support",
    "support:read",
  ),
  item(
    "All employees",
    "Every employee's stage, documents, pending and completed work",
    Users,
    "/support/employees",
    "support:read",
  ),
  item(
    "Requests",
    "Support requests from candidates and Client Admins",
    Inbox,
    "/support/requests",
    "support:handle",
  ),
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "notification:read",
    "account",
  ),
];
