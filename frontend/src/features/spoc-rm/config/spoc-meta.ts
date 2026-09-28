import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Gauge,
  MapPinned,
  ReceiptIndianRupee,
  TrendingUp,
} from "lucide-react";
import type { OversightTone } from "@/features/admin-dashboard/components/oversight-ui";
import type { StatusTone } from "@/lib/contracts/common";
import type {
  SpocDomain,
  SpocExceptionCategory,
  SpocHolderRole,
  SpocRole,
} from "../contracts/spoc";

export const SPOC_ROLE_ORDER: readonly SpocRole[] = [
  "OPS_MANAGER",
  "VERIFIER",
  "QA_REVIEWER",
  "CLIENT_ADMIN",
  "FIELD_EXECUTIVE",
  "SALES_MANAGER",
  "FINANCE_MANAGER",
];

export const SPOC_ROLE_META: Record<
  SpocRole,
  { label: string; icon: LucideIcon; tone: OversightTone }
> = {
  OPS_MANAGER: { label: "Operations Manager", icon: Gauge, tone: "blue" },
  VERIFIER: { label: "Verifier", icon: ClipboardCheck, tone: "mint" },
  QA_REVIEWER: { label: "QA Reviewer", icon: BadgeCheck, tone: "violet" },
  CLIENT_ADMIN: { label: "Client Admin", icon: Building2, tone: "amber" },
  FIELD_EXECUTIVE: { label: "Field Executive", icon: MapPinned, tone: "mint" },
  SALES_MANAGER: { label: "Sales Manager", icon: TrendingUp, tone: "blue" },
  FINANCE_MANAGER: { label: "Finance Manager", icon: ReceiptIndianRupee, tone: "rose" },
};

export const HOLDER_LABEL: Record<SpocHolderRole, string> = {
  OPS_MANAGER: "Operations",
  VERIFIER: "Verifier / Field",
  QA_REVIEWER: "QA Reviewer",
  CLIENT_ADMIN: "Client",
  FINANCE_MANAGER: "Finance",
  NONE: "Closed",
};

export const SPOC_BUCKETS = [
  "pending",
  "inProgress",
  "completed",
  "overdue",
  "exceptions",
] as const;
export type SpocBucket = (typeof SPOC_BUCKETS)[number];

export const BUCKET_LABEL: Record<SpocBucket, string> = {
  pending: "Pending",
  inProgress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
  exceptions: "Exceptions",
};

/**
 * Where a role-matrix cell opens. Two exception buckets have no record list of
 * their own and open the matching exception category instead.
 */
export function bucketTarget(
  role: SpocRole,
  bucket: SpocBucket,
):
  | { domain: SpocDomain; bucketRole?: "OPS_MANAGER" | "CLIENT_ADMIN"; status?: string }
  | { category: SpocExceptionCategory } {
  if (bucket === "exceptions") {
    if (role === "OPS_MANAGER") return { domain: "visits", status: "EXCEPTION_REVIEW" };
    if (role === "CLIENT_ADMIN") return { category: "rejected_documents" };
    if (role === "FINANCE_MANAGER") return { category: "credit_hold" };
  }
  const domain: Record<SpocRole, SpocDomain> = {
    OPS_MANAGER: "cases",
    VERIFIER: "tasks",
    QA_REVIEWER: "qa",
    CLIENT_ADMIN: "cases",
    FIELD_EXECUTIVE: "visits",
    SALES_MANAGER: "opportunities",
    FINANCE_MANAGER: "invoices",
  };
  return role === "OPS_MANAGER" || role === "CLIENT_ADMIN"
    ? { domain: domain[role], bucketRole: role }
    : { domain: domain[role] };
}

export const EXCEPTION_META: Record<
  SpocExceptionCategory,
  { label: string; role: SpocRole; tone: OversightTone }
> = {
  overdue: { label: "Overdue cases", role: "OPS_MANAGER", tone: "rose" },
  sla_approaching: { label: "SLA due in 8h", role: "OPS_MANAGER", tone: "amber" },
  no_ops_owner: { label: "No ops owner", role: "OPS_MANAGER", tone: "amber" },
  checks_unassigned: { label: "Checks without assignee", role: "OPS_MANAGER", tone: "amber" },
  blocked_tasks: { label: "Blocked tasks", role: "VERIFIER", tone: "rose" },
  non_clear_results: { label: "Discrepancy / unable to verify", role: "VERIFIER", tone: "rose" },
  qa_rework: { label: "QA rework", role: "QA_REVIEWER", tone: "violet" },
  report_failed: { label: "Failed reports", role: "QA_REVIEWER", tone: "rose" },
  client_clarifications: {
    label: "Open client clarifications",
    role: "CLIENT_ADMIN",
    tone: "amber",
  },
  rejected_documents: { label: "Rejected documents", role: "CLIENT_ADMIN", tone: "rose" },
  field_exception_review: {
    label: "Field exception review",
    role: "FIELD_EXECUTIVE",
    tone: "amber",
  },
  outside_geofence: { label: "Check-in outside geofence", role: "FIELD_EXECUTIVE", tone: "rose" },
  followup_overdue: { label: "Sales follow-up overdue", role: "SALES_MANAGER", tone: "amber" },
  invoice_overdue: { label: "Overdue invoices", role: "FINANCE_MANAGER", tone: "rose" },
  credit_hold: { label: "Clients on credit hold", role: "FINANCE_MANAGER", tone: "rose" },
};

export const DOMAIN_META: Record<SpocDomain, { label: string; role: SpocRole; search: string }> = {
  cases: { label: "Cases", role: "OPS_MANAGER", search: "Case, candidate, reference or client" },
  tasks: { label: "Verifier tasks", role: "VERIFIER", search: "Case, candidate or check type" },
  qa: { label: "QA", role: "QA_REVIEWER", search: "Case number or candidate" },
  visits: { label: "Field visits", role: "FIELD_EXECUTIVE", search: "Address, case or candidate" },
  opportunities: {
    label: "Opportunities",
    role: "SALES_MANAGER",
    search: "Company, contact or city",
  },
  invoices: { label: "Invoices", role: "FINANCE_MANAGER", search: "Invoice number or client" },
};

/** Status filter options per domain — the real stored values from the backend. */
export const DOMAIN_STATUSES: Record<SpocDomain, readonly string[]> = {
  cases: [
    "DRAFT",
    "CONSENT_PENDING",
    "DOCUMENT_PENDING",
    "IN_PROGRESS",
    "CLARIFICATION_PENDING",
    "QA_REVIEW",
    "MANAGER_REVIEW",
    "REPORT_PENDING",
    "PAYMENT_PENDING",
    "COMPLETED",
    "CLOSED",
    "CANCELLED",
  ],
  tasks: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"],
  qa: [],
  visits: [
    "ASSIGNED",
    "IN_PROGRESS",
    "REVIEW_PENDING",
    "EXCEPTION_REVIEW",
    "COMPLETED",
    "CANCELLED",
  ],
  opportunities: ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"],
  invoices: [
    "ISSUED",
    "PARTIALLY_PAID",
    "PARTIALLY_CREDITED",
    "PAID",
    "CREDITED",
    "SETTLED",
    "CANCELLED",
    "OVERDUE",
  ],
};

const CRITICAL = [
  "CANCELLED",
  "BLOCKED",
  "OVERDUE",
  "REWORK",
  "FAILED",
  "REJECTED",
  "EXCEPTION_REVIEW",
  "LOST",
  "SUSPENDED",
  "DISCREPANCY",
  "UNABLE_TO_VERIFY",
];
const SUCCESS = [
  "COMPLETED",
  "CLOSED",
  "APPROVED",
  "PAID",
  "SETTLED",
  "CREDITED",
  "PUBLISHED",
  "WON",
  "ACTIVE",
  "RESOLVED",
  "CLEAR",
  "VERIFIED",
];
const WARNING = [
  "CLARIFICATION_PENDING",
  "DOCUMENT_PENDING",
  "CONSENT_PENDING",
  "UNASSIGNED",
  "PARTIALLY_PAID",
  "PARTIALLY_CREDITED",
  "OPEN",
  "ONBOARDING",
  "PAYMENT_PENDING",
  "REUPLOAD_REQUIRED",
];
const REVIEW = [
  "QA_REVIEW",
  "MANAGER_REVIEW",
  "REVIEW_PENDING",
  "REPORT_PENDING",
  "PREPARED",
  "RESPONDED",
];

export function statusTone(value: string | null | undefined): StatusTone {
  if (!value) return "neutral";
  if (CRITICAL.includes(value)) return "critical";
  if (SUCCESS.includes(value)) return "success";
  if (WARNING.includes(value)) return "warning";
  if (REVIEW.includes(value)) return "review";
  return "info";
}
