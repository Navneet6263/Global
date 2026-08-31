import type { LucideIcon } from "lucide-react";
import type { Permission } from "./permissions";
import type { Role } from "./roles";

export type NavGroupId =
  "command" | "delivery" | "stakeholders" | "platform" | "revenue" | "work" | "account";

export type NavWorkspace =
  | "platform-admin"
  | "operations"
  | "sales-crm"
  | "client-admin"
  | "verifier"
  | "qa-reviewer"
  | "field-executive"
  | "finance";

export interface NavGroup {
  id: NavGroupId;
  label: string;
  defaultOpen: boolean;
}

export type NavBadgeTone = "info" | "warning" | "critical" | "review" | "neutral";

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
}

export interface WorkspaceNavigation {
  groups: readonly NavGroup[];
  items: readonly NavItem[];
}
