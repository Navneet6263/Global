import type { StatusTone, TrendDirection } from "./common";
import type { CasePriority, CaseStage } from "./case";

export type SummaryCardId =
  | "portfolio"
  | "sla-health"
  | "completion-time"
  | "client-action"
  | "completed-month"
  | "critical-exceptions";

export interface SummaryCard {
  id: SummaryCardId;
  label: string;
  value: string;
  description: string;
  comparison?: { label: string; delta: number; direction: TrendDirection };
  tone: StatusTone;
  series: readonly { label: string; value: number }[];
  target: { route: string; search?: Record<string, string> };
}

export interface PipelineStage {
  stage: CaseStage;
  count: number;
  shareOfPortfolio: number;
  mode: "processing" | "waiting" | "closed";
  oldestAgeMinutes: number;
  slaRiskCount: number;
  isBottleneck: boolean;
}

export type ActionKind =
  | "document_reupload"
  | "missing_candidate_info"
  | "candidate_clarification"
  | "client_clarification"
  | "consent_pending"
  | "sla_approaching"
  | "sla_overdue"
  | "verification_discrepancy"
  | "field_exception"
  | "qa_returned";

export type ActionTreatment =
  "response_required" | "document_rejected" | "under_review" | "sla_risk" | "critical_overdue";

export interface ActionItem {
  id: string;
  kind: ActionKind;
  treatment: ActionTreatment;
  candidateName: string;
  caseNumber: string;
  caseId: string;
  clientName: string;
  reason: string;
  responsible: string;
  waitingSinceMinutes: number;
  dueAt: string;
  severity: CasePriority;
  nextAction: string;
}

export interface ControlTowerSnapshot {
  generatedAt: string;
  summary: readonly SummaryCard[];
  pipeline: readonly PipelineStage[];
  actions: readonly ActionItem[];
}

export const ACTION_TREATMENT_META: Record<ActionTreatment, { label: string; tone: StatusTone }> = {
  response_required: { label: "Response required", tone: "warning" },
  document_rejected: { label: "Document rejected", tone: "critical" },
  under_review: { label: "Under review", tone: "review" },
  sla_risk: { label: "SLA risk", tone: "warning" },
  critical_overdue: { label: "Critical overdue", tone: "critical" },
};

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  document_reupload: "Document re-upload required",
  missing_candidate_info: "Missing candidate information",
  candidate_clarification: "Candidate clarification pending",
  client_clarification: "Client clarification pending",
  consent_pending: "Consent pending",
  sla_approaching: "SLA approaching",
  sla_overdue: "SLA overdue",
  verification_discrepancy: "Verification discrepancy",
  field_exception: "Field visit exception",
  qa_returned: "QA returned for correction",
};
