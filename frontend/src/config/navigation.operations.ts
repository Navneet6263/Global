import {
  BadgeCheck,
  ClipboardList,
  FileSearch,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Users,
} from "lucide-react";
import type { Role } from "./roles";
import type { NavGroup, NavItem } from "./navigation.types";

export const OPS_NAV_GROUPS: readonly NavGroup[] = [
  { id: "command", label: "Command", defaultOpen: true },
  { id: "delivery", label: "Delivery", defaultOpen: true },
  { id: "stakeholders", label: "People", defaultOpen: true },
];

const OPS: readonly Role[] = ["OPS_MANAGER"];

export const OPS_NAV_ITEMS: readonly NavItem[] = [
  item(
    "Operations Dashboard",
    "Workload, stage flow and today's queue",
    LayoutDashboard,
    "/operations",
    "command",
    "dashboard:read",
  ),
  item(
    "SLA Monitor",
    "Breach risk, ageing and bottlenecks",
    Gauge,
    "/operations/sla",
    "command",
    "dashboard:read",
    { key: "opsSlaRisk", tone: "warning" },
  ),
  item(
    "Case 360",
    "Every case with full delivery context",
    ClipboardList,
    "/operations/cases",
    "delivery",
    "case:read",
    { key: "opsActiveCases", tone: "info" },
  ),
  item(
    "Assignment Workbench",
    "Allocate checks to verifiers",
    BadgeCheck,
    "/operations/assignments",
    "delivery",
    "task:write",
    { key: "opsUnassigned", tone: "critical" },
  ),
  item(
    "Exceptions",
    "Blocked, breached and returned work",
    LifeBuoy,
    "/operations/exceptions",
    "delivery",
    "case:transition",
    { key: "opsExceptions", tone: "critical" },
  ),
  item(
    "Clarifications",
    "Candidate and client follow-ups",
    FileSearch,
    "/operations/clarifications",
    "delivery",
    "clarification:write",
    { key: "opsClarifications", tone: "review" },
  ),
  item(
    "Field Operations",
    "Visits, geofence and evidence review",
    MapPin,
    "/operations/field",
    "delivery",
    "field-visit:read",
  ),
  item(
    "Team Workload",
    "Verifier load and due-date pressure",
    Users,
    "/operations/team",
    "stakeholders",
    "user:read",
  ),
];

function item(
  label: string,
  description: string,
  icon: NavItem["icon"],
  route: string,
  group: NavItem["group"],
  permission: NavItem["permission"],
  badge?: NavItem["badge"],
): NavItem {
  return {
    workspace: "operations",
    label,
    description,
    icon,
    route,
    group,
    roles: OPS,
    permission,
    ...(badge ? { badge } : {}),
  };
}
