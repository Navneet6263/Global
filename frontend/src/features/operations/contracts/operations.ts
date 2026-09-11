import type { Paginated, StatusTone, TrendDirection } from "@/lib/contracts/common";
import type {
  OpsCase,
  OpsCheckType,
  OpsClarification,
  OpsFieldVisit,
  OpsPriority,
  OpsRisk,
  OpsSlaState,
  OpsStage,
} from "./case";

export type OpsMetricId =
  "active" | "unassigned" | "dueToday" | "slaRisk" | "clarifications" | "completedToday";

export interface OpsMetric {
  id: OpsMetricId;
  label: string;
  explanation: string;
  value: number;
  previousValue?: number;
  deltaPercent?: number;
  direction?: TrendDirection;
  tone: StatusTone;
  series: readonly number[];
  filterLabel: string;
}

export interface OpsStageSnapshot {
  stage: OpsStage;
  count: number;
  percent: number;
  oldestAgeMinutes: number;
  slaRiskCount: number;
  unassignedCount?: number;
  bottleneck: boolean;
}

export type OpsActionKind =
  | "unassigned_urgent"
  | "sla_approaching"
  | "sla_overdue"
  | "consent_waiting"
  | "document_reupload"
  | "candidate_clarification"
  | "verifier_blocked"
  | "field_exception"
  | "qa_returned"
  | "client_escalation";

export type OpsActionTreatment = "critical" | "action" | "processing" | "review" | "resolved";

export interface OpsActionItem {
  id: string;
  kind: OpsActionKind;
  treatment: OpsActionTreatment;
  severity: OpsPriority;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  stage: OpsStage;
  issue: string;
  waitingMinutes: number;
  slaMinutesRemaining: number;
  owner: string;
  nextAction: string;
}

export interface OpsDashboard {
  generatedAt: string;
  metrics: readonly OpsMetric[];
  stages: readonly OpsStageSnapshot[];
  actions: readonly OpsActionItem[];
  throughput: readonly { label: string; created: number; completed: number }[];
}

export interface OpsAssignableItem {
  id: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  checkType: OpsCheckType;
  checkLabel: string;
  priority: OpsPriority;
  slaState: OpsSlaState;
  slaMinutesRemaining: number;
  branch: string;
  city: string;
  requestedAt: string;
}

export interface OpsTeamMember {
  id: string;
  name: string;
  role: string;
  branch: string;
  activeCases: number;
  activeChecks: number;
  dueToday: number;
  overdue: number;
  completedToday: number;
  averageTurnaroundMinutes: number | null;
  relativeLoadPercent: number;
}

export interface AssignmentQueue {
  items: readonly OpsAssignableItem[];
  members: readonly OpsTeamMember[];
}

export interface AssignInput {
  itemIds: readonly string[];
  memberId: string;
  note?: string;
}

export interface AssignmentResult {
  assigned: number;
  memberName: string;
  warnings: readonly string[];
}

export type OpsExceptionType =
  | "sla_overdue"
  | "candidate_clarification"
  | "client_clarification"
  | "document_rejected"
  | "consent_problem"
  | "verifier_blocker"
  | "field_visit"
  | "geofence"
  | "evidence_quality"
  | "qa_return"
  | "system";

export type OpsExceptionSeverity = "critical" | "high" | "medium";

export interface OpsException {
  id: string;
  type: OpsExceptionType;
  severity: OpsExceptionSeverity;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  reason: string;
  raisedAt: string;
  ageMinutes: number;
  slaImpact: string;
  owner: string;
  latestUpdate: string;
  recommendedAction: string;
  status: "open" | "resolved";
  resolutionNote: string | null;
}

export interface OpsExceptionQuery {
  search?: string;
  type?: OpsExceptionType | "all";
  severity?: OpsExceptionSeverity | "all";
  owner?: string;
  ageBucket?: "all" | "under_24h" | "1_3d" | "over_3d";
  status?: "open" | "resolved";
  page?: number;
  pageSize?: number;
}

export interface SlaPerformance {
  healthPercent: number | null;
  dueNext7Days: number;
  overdue: number;
  averageTurnaroundMinutes: number | null;
  atRisk: readonly OpsCase[];
  stageAgeing: readonly { stage: OpsStage; averageAgeMinutes: number; oldestAgeMinutes: number }[];
  byClient: readonly { name: string; onTimePercent: number | null; volume: number }[];
  byPackage: readonly { name: string; onTimePercent: number | null; volume: number }[];
  weeklyTrend: readonly { label: string; onTimePercent: number | null; breaches: number }[];
  breachReasons: readonly { reason: string; count: number }[];
  bottlenecks: readonly { stage: OpsStage; detail: string; impactedCases: number }[];
}

export interface SlaQuery {
  from?: string;
  to?: string;
  clientId?: string;
  branch?: string;
  packageName?: string;
  priority?: OpsPriority | "all";
  checkType?: OpsCheckType | "all";
  owner?: string;
}

export interface TeamCapacity {
  members: readonly OpsTeamMember[];
  workload: readonly { name: string; checks: number }[];
  branches: readonly { branch: string; members: number; openChecks: number; loadPercent: number }[];
  demand: readonly { checkType: OpsCheckType; open: number }[];
  openAssignments: number;
}

export interface FieldOperations {
  scheduled: number;
  today: number;
  checkedIn: number;
  evidencePending: number;
  outsideGeofence: number;
  exceptionReview: number;
  reviewPending: number;
  completed: number;
  visits: readonly OpsFieldVisit[];
  executiveLoad: readonly { name: string; city: string; visitsToday: number; open: number }[];
}

export interface ClarificationQuery {
  state?: OpsClarification["state"] | "all" | "overdue";
  search?: string;
}

export interface ClarificationActionInput {
  clarificationId: string;
  action: "remind" | "resolve" | "request_again" | "review" | "note";
  note?: string;
}

export interface ClarificationResult {
  clarificationId: string;
  state: OpsClarification["state"];
  message: string;
}

export type OpsNotificationType =
  | "urgent_case"
  | "sla_approaching"
  | "sla_breached"
  | "clarification_response"
  | "document_reuploaded"
  | "field_exception"
  | "qa_returned"
  | "verification_completed"
  | "assignment_changed";

export interface OpsNotification {
  id: string;
  type: OpsNotificationType;
  title: string;
  detail: string;
  at: string;
  read: boolean;
  caseId: string | null;
  caseNumber: string | null;
  tone: StatusTone;
}

export interface CaseActionInput {
  caseId: string;
  action:
    | "assign_verifier"
    | "reassign_verifier"
    | "change_priority"
    | "update_due_date"
    | "add_note"
    | "raise_clarification"
    | "request_document"
    | "escalate"
    | "approve_field_exception"
    | "send_to_qa";
  value?: string;
  note?: string;
}

export interface CaseActionResult {
  caseId: string;
  message: string;
}

export interface OpsFacets {
  clients: readonly { value: string; label: string }[];
  owners: readonly { value: string; label: string }[];
  packages: readonly { value: string; label: string }[];
  branches: readonly { value: string; label: string }[];
}

export type PaginatedCases = Paginated<OpsCase>;
export type ExceptionQueue = Paginated<OpsException> & { openCount: number; resolvedCount: number };
export type { OpsRisk };
