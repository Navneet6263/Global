import type { CaseListItem } from "@/lib/backend-api/cases";
import { caseWorkflowSummary } from "@/features/cases/case-workflow-summary";
import { casePackageName } from "@/lib/backend-api/case-services";
import { normalizeCheckType } from "@/lib/contracts/check";
import type {
  OpsCase,
  OpsCheckStatus,
  OpsCheckType,
  OpsClarification,
  OpsFieldVisit,
  OpsPriority,
  OpsRisk,
  OpsSlaState,
  OpsStage,
} from "../contracts/case";

export const stages: Record<string, OpsStage> = {
  DRAFT: "intake",
  CONSENT_PENDING: "consent",
  DOCUMENT_PENDING: "documents",
  IN_PROGRESS: "verification",
  CLARIFICATION_PENDING: "clarification",
  QA_REVIEW: "qa",
  MANAGER_REVIEW: "manager_review",
  REPORT_PENDING: "report_pending",
  PAYMENT_PENDING: "payment_pending",
  COMPLETED: "completed",
  CLOSED: "completed",
  CANCELLED: "cancelled",
};

export const progress: Record<OpsStage, number> = {
  intake: 8,
  consent: 18,
  documents: 32,
  assignment: 42,
  verification: 62,
  clarification: 68,
  field_visit: 72,
  qa: 88,
  manager_review: 91,
  report_pending: 94,
  payment_pending: 97,
  completed: 100,
  cancelled: 100,
};

export function typeOf(value: string): OpsCheckType {
  return normalizeCheckType(value);
}

export function checkStatus(value: string): OpsCheckStatus {
  const map: Record<string, OpsCheckStatus> = {
    PENDING: "not_started",
    UNASSIGNED: "not_started",
    OPEN: "assigned",
    IN_PROGRESS: "in_progress",
    BLOCKED: "blocked",
    COMPLETED: "verified",
    DISCREPANCY: "discrepancy",
    UNABLE_TO_VERIFY: "unable_to_verify",
  };
  return map[value] ?? "not_started";
}

export function priorityOf(value: string): OpsPriority {
  return value === "URGENT" ? "critical" : value === "HIGH" ? "high" : "standard";
}

export function riskOf(value?: string | null): OpsRisk {
  return value === "HIGH" || value === "CRITICAL" ? "high" : value === "MEDIUM" ? "medium" : "low";
}

export function slaOf(dueAt?: string | null): { minutes: number; state: OpsSlaState } {
  if (!dueAt) return { minutes: 0, state: "healthy" };
  const minutes = Math.round((Date.parse(dueAt) - Date.now()) / 60_000);
  return { minutes, state: minutes < 0 ? "overdue" : minutes <= 480 ? "approaching" : "healthy" };
}

export function baseCase(row: CaseListItem): OpsCase {
  const assignedOpsUser = row.assignedOpsUser;
  const stage = stages[row.status] ?? "verification";
  const sla = slaOf(row.dueAt);
  const tasks = row.checks.flatMap((check) => check.tasks ?? []);
  const verifier = tasks.find((task) => task.assignee)?.assignee?.displayName ?? null;
  const fieldAssignment = (row.fieldVisits ?? []).find(
    (visit) => visit.status !== "COMPLETED" && visit.assignee,
  )?.assignee?.displayName;
  const completed = row.checks.filter((check) => check.status === "COMPLETED").length;
  return {
    id: row.id,
    workflow: caseWorkflowSummary(row),
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    candidateEmail: row.subject.email ?? "",
    candidateMobile: row.subject.phone ?? "",
    clientId: row.client.publicId,
    clientName: row.client.displayName,
    packageName: casePackageName(row) ?? `${row.checks.length}-check scope`,
    stage,
    progress: progress[stage],
    checksCompleted: completed,
    checksTotal: row.checks.length,
    priority: priorityOf(row.priority),
    risk: riskOf(row.riskLevel),
    slaMinutesRemaining: sla.minutes,
    slaState: sla.state,
    opsOwner: assignedOpsUser?.displayName ?? null,
    verifier,
    fieldAssignment: fieldAssignment ?? null,
    branch: row.branch?.name ?? "No branch assigned",
    city: row.branch?.city ?? row.branch?.name ?? "Location not recorded",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    blocker:
      tasks.find((task) => task.status === "BLOCKED")?.blockerReason ??
      tasks.find((task) => task.status === "BLOCKED")?.instructions ??
      null,
    nextAction:
      stage === "manager_review"
        ? "Review and approve the final outcome"
        : stage === "report_pending"
          ? "Monitor report generation"
          : stage === "payment_pending"
            ? "Confirm billing, settlement and report release"
            : stage === "cancelled"
              ? "Cancelled"
              : stage === "completed"
                ? "Review published report"
                : stage === "consent"
                  ? "Await candidate consent"
                  : stage === "documents"
                    ? "Review required documents"
                    : stage === "clarification"
                      ? "Review clarification response"
                      : stage === "qa"
                        ? "Await independent QA review"
                        : verifier
                          ? "Monitor verification"
                          : "Assign verifier",
    stageAgeMinutes: Math.max(0, Math.round((Date.now() - Date.parse(row.updatedAt)) / 60_000)),
  };
}

export function clarificationState(status: string): OpsClarification["state"] {
  if (status === "RESOLVED") return "resolved";
  if (["ANSWERED", "RESPONDED", "RESPONSE_RECEIVED", "CANDIDATE_SUBMITTED"].includes(status)) {
    return "response_received";
  }
  if (["UNDER_REVIEW", "DATA_ENTRY_PENDING"].includes(status)) return "under_review";
  return "awaiting_client";
}

export function fieldStatus(status: string): OpsFieldVisit["status"] {
  const map: Record<string, OpsFieldVisit["status"]> = {
    ASSIGNED: "scheduled",
    IN_PROGRESS: "checked_in",
    EVIDENCE_PENDING: "evidence_pending",
    OUTSIDE_GEOFENCE: "outside_geofence",
    EXCEPTION_REVIEW: "exception_review",
    REVIEW_PENDING: "review_pending",
    COMPLETED: "completed",
  };
  return map[status] ?? "scheduled";
}

export { detailCase } from "./api-operations-case-detail-mapper";
