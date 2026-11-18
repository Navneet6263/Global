import {
  CheckCircle2,
  ClipboardCheck,
  Hourglass,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import type { NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const VENDOR_ROLES: readonly Role[] = ["VENDOR"];

/** Work first (find, do, get paid), then document requests, team and account. */
export const VENDOR_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "My work", defaultOpen: true },
  { id: "revenue", label: "Payments", defaultOpen: true },
  { id: "work", label: "Document requests", defaultOpen: true },
  { id: "delivery", label: "Team & activity", defaultOpen: true },
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

/** Every vendor login; Team is managed by the Main Vendor (team users read it). */
export const VENDOR_NAV_ITEMS: readonly NavItem[] = [
  item("Home", "What needs you now, payments and new work", LayoutDashboard, "/vendor"),
  item(
    "Open queue",
    "Checks any vendor can pick: city, payment and due date",
    ListTodo,
    "/vendor/queue",
  ),
  item(
    "My checks",
    "Checks to verify: accept, submit results and proof",
    ClipboardCheck,
    "/vendor/checks",
  ),
  item(
    "Earnings",
    "Accepted checks and payment, month by month",
    Wallet,
    "/vendor/earnings",
    "revenue",
  ),
  item("Pending", "Waiting for your decision", Hourglass, "/vendor/pending", "work"),
  item("Approved", "Approved requests and their reports", CheckCircle2, "/vendor/approved", "work"),
  item("Rejected", "Requests you rejected with a reason", XCircle, "/vendor/rejected", "work"),
  item("All requests", "Every request assigned to you", Layers, "/vendor/all", "work"),
  item("Team", "Team user IDs and your Admin-set limit", Users, "/vendor/team", "delivery"),
  item("Logs", "Activity on your requests and team", ScrollText, "/vendor/logs", "delivery"),
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "account",
  ),
];
