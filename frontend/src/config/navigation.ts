import { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS } from "./navigation.admin";
import { CRM_NAV_GROUPS, CRM_NAV_ITEMS } from "./navigation.crm";
import { OPS_NAV_GROUPS, OPS_NAV_ITEMS } from "./navigation.operations";
import { ROLE_NAVIGATION } from "./navigation.roles";
import type { NavWorkspace, WorkspaceNavigation } from "./navigation.types";

export type {
  NavBadgeTone,
  NavGroup,
  NavGroupId,
  NavItem,
  NavWorkspace,
  WorkspaceNavigation,
} from "./navigation.types";

const NAVIGATION: Record<NavWorkspace, WorkspaceNavigation> = {
  "platform-admin": { groups: ADMIN_NAV_GROUPS, items: ADMIN_NAV_ITEMS },
  operations: { groups: OPS_NAV_GROUPS, items: OPS_NAV_ITEMS },
  "sales-crm": { groups: CRM_NAV_GROUPS, items: CRM_NAV_ITEMS },
  "client-admin": ROLE_NAVIGATION["client-admin"]!,
  verifier: ROLE_NAVIGATION.verifier!,
  "qa-reviewer": ROLE_NAVIGATION["qa-reviewer"]!,
  "field-executive": ROLE_NAVIGATION["field-executive"]!,
  finance: ROLE_NAVIGATION.finance!,
};

export function navFor(workspace: NavWorkspace): WorkspaceNavigation {
  return NAVIGATION[workspace];
}
