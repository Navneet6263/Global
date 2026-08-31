import type { CaseDetail, CaseListItem } from "@/lib/backend-api/cases";
import type {
  OpsCase,
  OpsCaseDetail,
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
  completed: 100,
  cancelled: 100,
};

export function typeOf(value: string): OpsCheckType {
  const type = value.toLowerCase();
  return ["identity", "address", "employment", "education", "criminal", "reference"].includes(type)
    ? (type as OpsCheckType)
    : "identity";
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
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    candidateEmail: row.subject.email ?? "",
    candidateMobile: row.subject.phone ?? "",
    clientId: row.client.publicId,
    clientName: row.client.displayName,
    packageName: `${row.checks.length}-check scope`,
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
      stage === "completed" ? "Closed" : verifier ? "Monitor verification" : "Assign verifier",
    stageAgeMinutes: Math.max(0, Math.round((Date.now() - Date.parse(row.updatedAt)) / 60_000)),
  };
}

export function clarificationState(status: string): OpsClarification["state"] {
  if (status === "RESOLVED") return "resolved";
  if (["ANSWERED", "RESPONDED", "RESPONSE_RECEIVED"].includes(status)) {
    return "response_received";
  }
  if (status === "UNDER_REVIEW") return "under_review";
  return "awaiting_client";
}

export function fieldStatus(status: string): OpsFieldVisit["status"] {
  const map: Record<string, OpsFieldVisit["status"]> = {
    ASSIGNED: "scheduled",
    IN_PROGRESS: "checked_in",
    EVIDENCE_PENDING: "evidence_pending",
    OUTSIDE_GEOFENCE: "outside_geofence",
    EXCEPTION_REVIEW: "exception_review",
    COMPLETED: "completed",
  };
  return map[status] ?? "scheduled";
}

export function detailCase(row: CaseDetail): OpsCaseDetail {
  const base = baseCase(row);
  const clarifications: OpsClarification[] = row.clarifications.map((item) => ({
    id: item.publicId,
    caseId: row.id,
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    clientName: row.client.displayName,
    checkLabel: "Case",
    subject: item.subject,
    audience: "client",
    state: clarificationState(item.status),
    requestedBy: "Operations",
    requestedAt: item.createdAt,
    dueAt: item.dueAt ?? item.createdAt,
    overdue: Boolean(
      item.dueAt && Date.parse(item.dueAt) < Date.now() && item.status !== "RESOLVED",
    ),
    messages: [],
  }));
  const fieldVisits: OpsFieldVisit[] = row.fieldVisits.map((visit) => ({
    id: visit.publicId,
    caseId: row.id,
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    clientName: row.client.displayName,
    address: visit.address,
    city: row.branch?.city ?? row.branch?.name ?? "Location not recorded",
    fieldExecutive: visit.assignee?.displayName ?? "Unassigned",
    scheduledAt: visit.createdAt,
    status: fieldStatus(visit.status),
    geofenceMetres: visit.geofenceMeters,
    evidenceCount: visit.evidence?.length ?? visit._count?.evidence ?? 0,
    note: visit.distanceMeters ? `${visit.distanceMeters} metres from target` : "",
  }));
  const latestConsent = row.consents[0];
  return {
    ...base,
    checks: row.checks.map((check) => ({
      id: check.publicId,
      type: typeOf(check.type),
      label: check.type.replaceAll("_", " "),
      status: checkStatus(check.status),
      verifier: check.tasks?.find((task) => task.assignee)?.assignee?.displayName ?? null,
      startedAt: null,
      dueAt: check.dueAt ?? row.dueAt ?? row.updatedAt,
      result: check.result ?? null,
      risk: riskOf(check.riskLevel),
      sourceSummary: check.sourceSummary ?? "",
      blocker: check.tasks?.find((task) => task.status === "BLOCKED")?.instructions ?? null,
    })),
    documents: row.documents.map((item) => {
      const latest = item.versions[0];
      return {
        id: item.publicId,
        label: item.type.replaceAll("_", " "),
        status:
          item.status === "VERIFIED"
            ? ("verified" as const)
            : item.status === "REJECTED"
              ? ("rejected" as const)
              : item.currentVersion
                ? ("received" as const)
                : ("pending" as const),
        originalName: latest?.originalName ?? null,
        version: item.currentVersion,
        available: Boolean(latest && item.currentVersion > 0),
        updatedAt: latest?.createdAt ?? row.updatedAt,
        ...(latest ? { note: `v${latest.version} · ${latest.malwareState.toLowerCase()}` } : {}),
      };
    }),
    consent: {
      id: latestConsent?.publicId ?? null,
      status:
        latestConsent?.status === "ACCEPTED" ? "signed" : latestConsent ? "pending" : "missing",
      channel: "portal",
      requestedAt: latestConsent?.createdAt ?? row.createdAt,
      signedAt: latestConsent?.acceptedAt ?? null,
      ipAddress: null,
    },
    assignments: row.checks.flatMap((check) =>
      (check.tasks ?? [])
        .filter((task) => task.assignee)
        .map((task) => ({
          id: task.publicId,
          assignee: task.assignee!.displayName,
          role: "Verifier",
          checkLabel: check.type.replaceAll("_", " "),
          assignedAt: row.updatedAt,
          assignedBy: "Operations",
        })),
    ),
    clarifications,
    fieldVisits,
    qaHistory: row.qaReviews.map((review, index) => ({
      id: `${row.id}-qa-${index}`,
      reviewer: "QA reviewer",
      at: review.createdAt,
      outcome:
        review.decision === "APPROVED"
          ? "passed"
          : review.decision === "RETURNED"
            ? "returned"
            : "pending",
      defect: review.decision === "RETURNED" ? (review.notes ?? "Correction required") : null,
      note: review.notes ?? "",
    })),
    reports: row.reports.map((report) => ({
      id: report.publicId,
      version: `v${report.currentVersion}`,
      generatedAt: report.publishedAt ?? report.createdAt,
      outcome: "clear",
      sizeKb: 0,
      releasedToClient: Boolean(report.publishedAt),
    })),
    timeline: row.statusHistory.map((event, index) => ({
      id: `${row.id}-history-${index}`,
      label: event.toStatus.replaceAll("_", " "),
      detail: event.reason ?? "Workflow status updated",
      at: event.createdAt,
      stage: stages[event.toStatus] ?? "verification",
      actor: "Platform workflow",
    })),
    alerts: [
      ...(base.slaState === "overdue"
        ? [
            {
              id: "sla",
              tone: "critical" as const,
              label: "SLA overdue",
              detail: "This case is past its committed due date.",
            },
          ]
        : []),
      ...(base.blocker
        ? [
            {
              id: "blocker",
              tone: "warning" as const,
              label: "Verification blocked",
              detail: base.blocker,
            },
          ]
        : []),
    ],
  };
}
