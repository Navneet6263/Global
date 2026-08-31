import type { StatusTone } from "@/lib/contracts/common";

export type OpsStage =
  | "intake"
  | "consent"
  | "documents"
  | "assignment"
  | "verification"
  | "clarification"
  | "field_visit"
  | "qa"
  | "completed"
  | "cancelled";

export type OpsPriority = "standard" | "high" | "critical";
export type OpsRisk = "low" | "medium" | "high";
export type OpsSlaState = "healthy" | "approaching" | "overdue";

export type OpsCheckType =
  "identity" | "address" | "employment" | "education" | "criminal" | "reference";

export type OpsCheckStatus =
  | "not_started"
  | "assigned"
  | "in_progress"
  | "awaiting_input"
  | "blocked"
  | "verified"
  | "discrepancy"
  | "unable_to_verify";

export interface OpsCheck {
  id: string;
  type: OpsCheckType;
  label: string;
  status: OpsCheckStatus;
  verifier: string | null;
  startedAt: string | null;
  dueAt: string;
  result: string | null;
  risk: OpsRisk;
  sourceSummary: string;
  blocker: string | null;
}

export interface OpsDocument {
  id: string;
  label: string;
  status: "pending" | "received" | "rejected" | "reupload_required" | "verified";
  updatedAt: string;
  note?: string;
}

export interface OpsConsent {
  status: "pending" | "signed" | "expired" | "missing";
  channel: "email" | "sms" | "portal";
  requestedAt: string;
  signedAt: string | null;
  ipAddress: string | null;
}

export interface OpsAssignmentEntry {
  id: string;
  assignee: string;
  role: string;
  checkLabel: string;
  assignedAt: string;
  assignedBy: string;
  note?: string;
}

export interface OpsClarificationMessage {
  id: string;
  author: string;
  at: string;
  body: string;
  internal: boolean;
}

export interface OpsClarification {
  id: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  checkLabel: string;
  subject: string;
  audience: "candidate" | "client";
  state:
    "awaiting_candidate" | "awaiting_client" | "response_received" | "under_review" | "resolved";
  requestedBy: string;
  requestedAt: string;
  dueAt: string;
  overdue: boolean;
  messages: readonly OpsClarificationMessage[];
}

export interface OpsFieldVisit {
  id: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  address: string;
  city: string;
  fieldExecutive: string;
  scheduledAt: string;
  status:
    | "scheduled"
    | "checked_in"
    | "evidence_pending"
    | "outside_geofence"
    | "exception_review"
    | "completed";
  geofenceMetres: number | null;
  evidenceCount: number;
  note: string;
}

export interface OpsQaEntry {
  id: string;
  reviewer: string;
  at: string;
  outcome: "passed" | "returned" | "pending";
  defect: string | null;
  note: string;
}

export interface OpsReport {
  id: string;
  version: string;
  generatedAt: string;
  outcome: "clear" | "minor_discrepancy" | "major_discrepancy";
  sizeKb: number;
  releasedToClient: boolean;
}

export interface OpsTimelineEvent {
  id: string;
  label: string;
  detail: string;
  at: string;
  stage: OpsStage;
  actor: string;
}

export interface OpsCase {
  id: string;
  caseNumber: string;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  clientId: string;
  clientName: string;
  packageName: string;
  stage: OpsStage;
  progress: number;
  checksCompleted: number;
  checksTotal: number;
  priority: OpsPriority;
  risk: OpsRisk;
  slaMinutesRemaining: number;
  slaState: OpsSlaState;
  opsOwner: string | null;
  verifier: string | null;
  fieldAssignment: string | null;
  branch: string;
  city: string;
  createdAt: string;
  updatedAt: string;
  blocker: string | null;
  nextAction: string;
  stageAgeMinutes: number;
}

export interface OpsCaseDetail extends OpsCase {
  checks: readonly OpsCheck[];
  documents: readonly OpsDocument[];
  consent: OpsConsent;
  assignments: readonly OpsAssignmentEntry[];
  clarifications: readonly OpsClarification[];
  fieldVisits: readonly OpsFieldVisit[];
  qaHistory: readonly OpsQaEntry[];
  reports: readonly OpsReport[];
  timeline: readonly OpsTimelineEvent[];
  alerts: readonly { id: string; tone: StatusTone; label: string; detail: string }[];
}

export interface OpsCaseQuery {
  search?: string;
  stage?: OpsStage | "all";
  clientId?: string;
  priority?: OpsPriority | "all";
  risk?: OpsRisk | "all";
  sla?: OpsSlaState | "all";
  owner?: string;
  unassigned?: boolean;
  dueToday?: boolean;
  dueNext7Days?: boolean;
  from?: string;
  to?: string;
  sortBy?: "updatedAt" | "sla" | "candidateName" | "progress" | "priority";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const OPS_STAGE_META: Record<OpsStage, { label: string; tone: StatusTone; short: string }> =
  {
    intake: { label: "Intake validation", tone: "neutral", short: "Intake" },
    consent: { label: "Consent", tone: "warning", short: "Consent" },
    documents: { label: "Documents", tone: "warning", short: "Documents" },
    assignment: { label: "Assignment", tone: "info", short: "Assignment" },
    verification: { label: "Verification", tone: "info", short: "Verification" },
    clarification: { label: "Clarification", tone: "warning", short: "Clarification" },
    field_visit: { label: "Field visit", tone: "info", short: "Field visit" },
    qa: { label: "QA review", tone: "review", short: "QA review" },
    completed: { label: "Completed", tone: "success", short: "Completed" },
    cancelled: { label: "Cancelled", tone: "neutral", short: "Cancelled" },
  };

export const OPS_STAGE_ORDER: readonly OpsStage[] = [
  "intake",
  "consent",
  "documents",
  "assignment",
  "verification",
  "clarification",
  "field_visit",
  "qa",
  "completed",
];

export const OPS_PRIORITY_META: Record<OpsPriority, { label: string; tone: StatusTone }> = {
  standard: { label: "Standard", tone: "neutral" },
  high: { label: "High", tone: "warning" },
  critical: { label: "Critical", tone: "critical" },
};

export const OPS_RISK_META: Record<OpsRisk, { label: string; tone: StatusTone }> = {
  low: { label: "Low risk", tone: "success" },
  medium: { label: "Medium risk", tone: "warning" },
  high: { label: "High risk", tone: "critical" },
};

export const OPS_SLA_META: Record<OpsSlaState, { label: string; tone: StatusTone }> = {
  healthy: { label: "On track", tone: "success" },
  approaching: { label: "At risk", tone: "warning" },
  overdue: { label: "Overdue", tone: "critical" },
};

export const OPS_CHECK_LABELS: Record<OpsCheckType, string> = {
  identity: "Identity",
  address: "Address",
  employment: "Employment",
  education: "Education",
  criminal: "Criminal / court",
  reference: "Reference",
};

export const OPS_CHECK_STATUS_META: Record<OpsCheckStatus, { label: string; tone: StatusTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  assigned: { label: "Assigned", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  awaiting_input: { label: "Awaiting input", tone: "warning" },
  blocked: { label: "Blocked", tone: "critical" },
  verified: { label: "Verified", tone: "success" },
  discrepancy: { label: "Discrepancy", tone: "critical" },
  unable_to_verify: { label: "Unable to verify", tone: "critical" },
};

export const OPS_DOCUMENT_STATUS_META: Record<
  OpsDocument["status"],
  { label: string; tone: StatusTone }
> = {
  pending: { label: "Pending", tone: "warning" },
  received: { label: "Received", tone: "info" },
  rejected: { label: "Rejected", tone: "critical" },
  reupload_required: { label: "Re-upload required", tone: "critical" },
  verified: { label: "Verified", tone: "success" },
};

export const OPS_CLARIFICATION_STATE_META: Record<
  OpsClarification["state"],
  { label: string; tone: StatusTone }
> = {
  awaiting_candidate: { label: "Awaiting candidate", tone: "warning" },
  awaiting_client: { label: "Awaiting client", tone: "warning" },
  response_received: { label: "Response received", tone: "info" },
  under_review: { label: "Under review", tone: "review" },
  resolved: { label: "Resolved", tone: "success" },
};

export const OPS_FIELD_STATUS_META: Record<
  OpsFieldVisit["status"],
  { label: string; tone: StatusTone }
> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  checked_in: { label: "Checked in", tone: "info" },
  evidence_pending: { label: "Evidence pending", tone: "warning" },
  outside_geofence: { label: "Outside geofence", tone: "critical" },
  exception_review: { label: "Exception review", tone: "critical" },
  completed: { label: "Completed", tone: "success" },
};
