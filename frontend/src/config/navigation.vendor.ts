import {
  CheckCircle2,
  Hourglass,
  Inbox,
  KeyRound,
  Layers,
  ScrollText,
  Users,
  XCircle,
} from "lucide-react";
import type { NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const VENDOR_ROLES: readonly Role[] = ["VENDOR"];

export const VENDOR_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Workspace", defaultOpen: true },
  { id: "work", label: "Requests", defaultOpen: true },
  { id: "delivery", label: "Activity", defaultOpen: true },
  { id: "account", label: "Account", defaultOpen: true },
];

function item(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  group: NavItem["group"] = "command",
): NavItem {
  return {
    workspace: "vendor",
    label,
    description,
    icon,
    route,
    group,
    roles: VENDOR_ROLES,
    permission: group === "account" ? "notification:read" : "vendor:review",
  };
}

/** Requests for every vendor login; Team is managed by the Main Vendor (team users read it). */
export const VENDOR_NAV_ITEMS: readonly NavItem[] = [
  item("Vendor Requests", "Overview of the documents assigned to you", Inbox, "/vendor"),
  item("Team", "Team user IDs and your Admin-set limit", Users, "/vendor/team"),
  item("Pending", "Waiting for your decision", Hourglass, "/vendor/pending", "work"),
  item("Approved", "Approved requests and their reports", CheckCircle2, "/vendor/approved", "work"),
  item("Rejected", "Requests you rejected with a reason", XCircle, "/vendor/rejected", "work"),
  item("All", "Every request assigned to you", Layers, "/vendor/all", "work"),
  item("Logs", "Activity on your requests and team", ScrollText, "/vendor/logs", "delivery"),
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "account",
  ),
];
