import type { StatusTone } from "./common";
import type { CheckType } from "./check";
export type { CheckType } from "./check";
export { CHECK_LABELS } from "./check";

export type CaseStage =
  | "intake"
  | "consent"
  | "documents"
  | "verification"
  | "clarification"
  | "qa"
  | "manager_review"
  | "report_pending"
  | "payment_pending"
  | "completed";

export type CasePriority = "standard" | "high" | "critical";

export type SlaState = "healthy" | "approaching" | "overdue";

export type CheckStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_input"
  | "verified"
  | "discrepancy"
  | "unable_to_verify";

export interface VerificationCheck {
  id: string;
  type: CheckType;
  label: string;
  status: CheckStatus;
  assignee: string;
  updatedAt: string;
  note?: string;
}

export interface CaseDocument {
  id: string;
  label: string;
  status: "pending" | "received" | "rejected" | "verified";
  updatedAt: string;
  rejectionReason?: string;
  originalName?: string;
  available?: boolean;
}

export interface CaseClarification {
  id: string;
  raisedBy?: string;
  audience?: "candidate" | "client" | "internal";
  question: string;
  status: "open" | "answered" | "closed";
  raisedAt: string;
  dueAt: string | null;
}

export interface CaseTimelineEvent {
  id: string;
  label: string;
  detail: string;
  at: string;
  stage: CaseStage;
}

export interface CaseAssignmentEntry {
  id: string;
  owner: string;
  role: string;
  from: string;
  reason: string;
}

export interface CaseReport {
  id: string;
  version: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface VerificationCase {
  id: string;
  caseNumber: string;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  clientId: string;
  clientName: string;
  packageName: string | null;
  checkBundle: readonly CheckType[];
  stage: CaseStage;
  progress: number;
  priority: CasePriority;
  slaMinutesRemaining: number;
  slaState: SlaState;
  owner: string | null;
  branch: string | null;
  createdAt: string;
  updatedAt: string;
  checks: readonly VerificationCheck[];
  documents: readonly CaseDocument[];
  clarifications: readonly CaseClarification[];
  timeline: readonly CaseTimelineEvent[];
  assignments: readonly CaseAssignmentEntry[];
  reports: readonly CaseReport[];
}

export interface CaseQuery {
  search?: string;
  stage?: CaseStage | "all";
  clientId?: string | "all";
  priority?: CasePriority | "all";
  sla?: SlaState | "all";
  from?: string;
  to?: string;
  sortBy?: "updatedAt" | "sla" | "candidateName";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const STAGE_META: Record<CaseStage, { label: string; tone: StatusTone; mode: string }> = {
  intake: { label: "Case intake", tone: "neutral", mode: "Processing" },
  consent: { label: "Consent", tone: "warning", mode: "Waiting on candidate" },
  documents: { label: "Documents", tone: "warning", mode: "Waiting on candidate" },
  verification: { label: "Verification", tone: "info", mode: "Processing" },
  clarification: { label: "Clarification", tone: "warning", mode: "Waiting on stakeholder" },
  qa: { label: "QA review", tone: "review", mode: "Processing" },
  manager_review: { label: "Manager approval", tone: "review", mode: "Awaiting approval" },
  report_pending: { label: "Report preparation", tone: "info", mode: "Processing" },
  payment_pending: { label: "Payment & release", tone: "warning", mode: "Awaiting settlement" },
  completed: { label: "Completed", tone: "success", mode: "Closed" },
};

export const PRIORITY_META: Record<CasePriority, { label: string; tone: StatusTone }> = {
  standard: { label: "Standard", tone: "neutral" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "critical" },
};

export const CHECK_STATUS_META: Record<CheckStatus, { label: string; tone: StatusTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  awaiting_input: { label: "Awaiting input", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  discrepancy: { label: "Discrepancy", tone: "critical" },
  unable_to_verify: { label: "Unable to verify", tone: "critical" },
};
