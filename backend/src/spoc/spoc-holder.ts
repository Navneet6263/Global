import { CaseStatuses } from "../cases/case.constants";
import { settledInvoiceStatuses } from "../finance/finance.shared";

/** The seven operational roles SPOC-RM monitors. */
export const SpocRoles = [
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
] as const;
export type SpocRole = (typeof SpocRoles)[number];

/** Case roles that can currently hold a case (sales never holds a case). */
export const SpocHolderRoles = [
  "CLIENT_ADMIN",
  "VERIFIER",
  "QA_REVIEWER",
  "OPS_MANAGER",
  "FINANCE_MANAGER",
  "NONE",
] as const;
export type SpocHolderRole = (typeof SpocHolderRoles)[number];

export const terminalCaseStatuses = ["COMPLETED", "CLOSED", "CANCELLED"];
export const activeTaskStatuses = [
  "UNASSIGNED",
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
];
export const openVisitStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "REVIEW_PENDING",
  "EXCEPTION_REVIEW",
];
export const unsettledInvoiceStatuses = [
  "ISSUED",
  "PARTIALLY_PAID",
  "PARTIALLY_CREDITED",
  "OVERDUE",
] as const;
export { settledInvoiceStatuses };

/**
 * Which role holds a case in each status. Derived from the endpoint guards that
 * can move a case out of that status (see cases/case.constants caseTransitions).
 */
export const caseHolder: Record<(typeof CaseStatuses)[number], SpocHolderRole> =
  {
    DRAFT: "CLIENT_ADMIN",
    CONSENT_PENDING: "CLIENT_ADMIN",
    DOCUMENT_PENDING: "CLIENT_ADMIN",
    CLARIFICATION_PENDING: "CLIENT_ADMIN",
    IN_PROGRESS: "VERIFIER",
    QA_REVIEW: "QA_REVIEWER",
    MANAGER_REVIEW: "OPS_MANAGER",
    REPORT_PENDING: "OPS_MANAGER",
    PAYMENT_PENDING: "FINANCE_MANAGER",
    COMPLETED: "NONE",
    CLOSED: "NONE",
    CANCELLED: "NONE",
  };

export function holderOf(status: string): SpocHolderRole {
  return caseHolder[status as keyof typeof caseHolder] ?? "NONE";
}

export function statusesHeldBy(role: SpocHolderRole): string[] {
  return Object.entries(caseHolder)
    .filter(([, holder]) => holder === role)
    .map(([status]) => status);
}

/** Same 8-hour window as the case register's "approaching" SLA state. */
export const SLA_APPROACHING_HOURS = 8;
