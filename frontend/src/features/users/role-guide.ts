import type { Role } from "@/config/roles";
import { FIELD_WORK_ENABLED } from "@/config/features";

/** Plain-language "what this person does / cannot do" for the Create user panel. */
export const ROLE_GUIDE: Partial<Record<Role, { does: string; cannot: string }>> = {
  DATA_ENTRY: {
    does: "Checks the candidate's documents, fills each check's details, raises L1 when something is missing and marks the case Ready.",
    cannot: "Verify checks, approve reports or see billing.",
  },
  VERIFIER: {
    does: "Works checks assigned to them: contacts sources, records what was verified and closes each check. A Team Leader also assigns work in the team.",
    cannot: "Approve QC, release reports or change user IDs.",
  },
  QA_REVIEWER: {
    does: "Reviews every finished case end to end and approves it or sends it back for rework.",
    cannot: "Verify checks themselves or release reports.",
  },
  SPOC_RM: {
    does: "Looks after their client companies: assigns Data Entry, routes checks to teams, gives the final approval and follows up payments.",
    cannot: "Change packages beyond their discount limit or manage user IDs.",
  },
  OPS_MANAGER: {
    does: "Runs delivery: teams, allocation, SLAs, escalations, packages and company onboarding.",
    cannot: "Be combined with another role (always a single role).",
  },
  FINANCE_MANAGER: {
    does: "Raises invoices, records payments and credits, sends billing annexures.",
    cannot: "See case evidence or change verification results.",
  },
  FIELD_EXECUTIVE: {
    does: "Completes assigned field visits with GPS and photo evidence.",
    cannot: "See cases that are not assigned to them.",
  },
  CLIENT_ADMIN: {
    does: "Represents one client company: creates cases, answers queries, downloads reports and invoices.",
    cannot: "See any other company or internal notes.",
  },
  SALES_MANAGER: {
    does: "Manages leads, opportunities and client onboarding in the CRM.",
    cannot: "Work verification cases.",
  },
  SUPPORT_AGENT: {
    does: "Answers support requests across companies (read-only on cases).",
    cannot: "Change cases or user IDs.",
  },
  VENDOR: {
    does: "External partner: works only the checks and documents sent to it.",
    cannot: "See anything else in the portal.",
  },
  PLATFORM_ADMIN: {
    does: "Full oversight: user IDs, roles, settings and audit across every workspace.",
    cannot: "Be combined with another role.",
  },
};

/** Roles that are always held alone (mirrors the API rule). */
export const SINGLE_ROLES: readonly Role[] = [
  "PLATFORM_ADMIN",
  "OPS_MANAGER",
  "CLIENT_ADMIN",
  "VENDOR",
  "SUPPORT_AGENT",
];

/** Roles whose access can be narrowed with ticks (a personal role is created). */
export const CUSTOMISABLE_ROLES: readonly Role[] = [
  "DATA_ENTRY",
  "VERIFIER",
  "QA_REVIEWER",
  "FINANCE_MANAGER",
  "FIELD_EXECUTIVE",
];

/** Permission codes in everyday words. */
export const PERMISSION_LABELS: Readonly<Record<string, string>> = {
  "dashboard:read": "See their dashboard",
  "notification:read": "Get notifications",
  "case:read": "See cases",
  "case:create": "Create cases",
  "case:transition": "Move cases to the next stage",
  "document:read": "Open documents",
  "document:write": "Upload documents",
  "clarification:read": "See insufficiency and queries",
  "clarification:write": "Raise insufficiency (L1 / L2)",
  "task:read": "See assigned checks",
  "task:write": "Work and complete checks",
  "qa:review": "Approve or return in QC",
  "report:read": "Download reports",
  "report:generate": "Generate and release reports",
  "finance:read": "See invoices and payments",
  "finance:write": "Create invoices, payments and credits",
  "field-visit:read": "See field visits",
  "field-visit:write": "Complete field visits",
  "field-evidence:read": "See field evidence",
  "consent:manage": "Manage candidate consent",
  "client:read": "See client companies",
  "client:write": "Edit client companies",
  "vendor:assign": "Send work to vendors",
  "vendor:review": "Work vendor requests",
  "support:read": "See support requests",
  "support:handle": "Answer support requests",
  "support:request": "Raise support requests",
  "crm:read": "See CRM",
  "crm:write": "Edit CRM",
};

export const permissionLabel = (code: string) =>
  PERMISSION_LABELS[code] ??
  code.replace(/[:_-]/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

/** Roles that exist but are switched off for now (shown as "Coming soon"). */
export const COMING_SOON: readonly Role[] = FIELD_WORK_ENABLED ? [] : ["FIELD_EXECUTIVE"];

/**
 * Pick one or more roles. Working roles combine (e.g. RM + Data Entry); single roles
 * replace everything else. Used by Create user and Edit role & access.
 */
export function nextRoles(current: readonly Role[], role: Role): Role[] {
  if (current.includes(role)) return current.filter((value) => value !== role);
  if (SINGLE_ROLES.includes(role)) return [role];
  return [...current.filter((value) => !SINGLE_ROLES.includes(value)), role].slice(-3);
}
