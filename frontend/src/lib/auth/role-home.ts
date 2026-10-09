import type { Role } from "@/config/roles";

/** Each working role's home; a person with several roles moves between these. */
export const ROLE_HOME: Partial<Record<Role, string>> = {
  SPOC_RM: "/spoc-rm/work",
  DATA_ENTRY: "/data-entry",
  VERIFIER: "/verifier",
  QA_REVIEWER: "/qa-review",
  FINANCE_MANAGER: "/finance",
  FIELD_EXECUTIVE: "/field-executive",
  SALES_MANAGER: "/sales-crm",
};

const ACTIVE_ROLE_KEY = "sg-active-role";

export function rememberedRole(roles: readonly Role[]): Role | null {
  try {
    const saved = localStorage.getItem(ACTIVE_ROLE_KEY) as Role | null;
    return saved && roles.includes(saved) && ROLE_HOME[saved] ? saved : null;
  } catch {
    return null;
  }
}

export function rememberRole(role: Role) {
  try {
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
  } catch {
    /* Preference only. */
  }
}
