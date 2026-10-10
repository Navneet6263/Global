import {
  AlarmClock,
  BadgePercent,
  Building2,
  FileSpreadsheet,
  Handshake,
  IndianRupee,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Rocket,
  Siren,
  TableProperties,
  Truck,
} from "lucide-react";
import type { NavBadgeTone, NavGroup, NavItem } from "./navigation.types";
import type { Role } from "./roles";

const SPOC_ROLES: readonly Role[] = ["SPOC_RM", "PLATFORM_ADMIN"];

export const SPOC_NAV_GROUPS: readonly NavGroup[] = [
  { id: "work", label: "My work", defaultOpen: true },
  { id: "delivery", label: "Needs attention", defaultOpen: true },
  { id: "stakeholders", label: "Clients", defaultOpen: true },
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
  extra: Partial<Pick<NavItem, "badge" | "search" | "sub">> = {},
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
    ...extra,
  };
}

/** A filtered view of the work queue, shown indented under "My work overview". */
const step = (
  label: string,
  description: string,
  bucket: string,
  key: string,
  tone: NavBadgeTone,
) =>
  item(label, description, ListTodo, "/spoc-rm/work", "work", "case:read", {
    search: { bucket },
    sub: true,
    badge: { key, tone },
  });

export const SPOC_NAV_ITEMS: readonly NavItem[] = [
  item(
    "My work overview",
    "Your numbers, cases by stage, the action queue and a client pulse",
    LayoutDashboard,
    "/spoc-rm/work",
    "work",
    "case:read",
    { badge: { key: "rmActive", tone: "neutral" } },
  ),
  step(
    "Assign Data Entry",
    "New cases waiting for you to assign Data Entry",
    "needs_data_entry",
    "rmNeedsDataEntry",
    "info",
  ),
  step(
    "Ready to route",
    "Data Entry finished: route checks to departments",
    "ready",
    "rmReady",
    "info",
  ),
  step(
    "Final reviews",
    "QC passed: your approve or return decision",
    "final_approval",
    "rmFinal",
    "warning",
  ),
  step(
    "Corrections & queries",
    "Waiting on the candidate or client",
    "correction",
    "rmCorrections",
    "warning",
  ),
  item(
    "Escalations",
    "Cases the client or Sapling management escalated: high priority",
    Siren,
    "/spoc-rm/work",
    "delivery",
    "case:read",
    { search: { flag: "escalated" }, badge: { key: "rmEscalated", tone: "critical" } },
  ),
  item(
    "Overdue cases",
    "Past their due time: act or update the client",
    AlarmClock,
    "/spoc-rm/work",
    "delivery",
    "case:read",
    { search: { flag: "overdue" }, badge: { key: "rmOverdue", tone: "critical" } },
  ),
  item(
    "Onboarding companies",
    "New self sign-up companies you help to go live",
    Rocket,
    "/spoc-rm/onboarding",
    "stakeholders",
    "case:read",
  ),
  item(
    "My clients",
    "Per-client progress, exceptions and receivables",
    Building2,
    "/spoc-rm/clients",
    "stakeholders",
  ),
  item(
    "Vendor work",
    "Checks with vendors: ageing, overdue, results to review",
    Truck,
    "/spoc-rm/vendor-work",
    "delivery",
    "case:read",
  ),
  item(
    "Payments",
    "Dues per company: record payments, invoices and reminders",
    IndianRupee,
    "/spoc-rm/payments",
    "stakeholders",
    "case:read",
  ),
  item(
    "Company MIS",
    "Generate and download a company's MIS with colour codes",
    FileSpreadsheet,
    "/spoc-rm/mis",
    "stakeholders",
    "case:read",
  ),
  item(
    "Client pricing",
    "Give your clients a discount within the package limit",
    BadgePercent,
    "/spoc-rm/pricing",
    "stakeholders",
    "case:read",
  ),
  item(
    "Vendors",
    "Assign client documents to vendors and track decisions",
    Handshake,
    "/spoc-rm/vendors",
    "stakeholders",
    "vendor:assign",
  ),
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
  item(
    "Account Security",
    "Password, sessions and sign-in activity",
    KeyRound,
    "/change-password",
    "account",
    "notification:read",
  ),
];
