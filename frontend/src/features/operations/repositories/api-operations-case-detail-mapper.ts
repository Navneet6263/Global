import type { CaseDetail } from "@/lib/backend-api/cases";
import { checkLabel } from "@/lib/contracts/check";
import type { OpsCaseDetail, OpsClarification, OpsFieldVisit } from "../contracts/case";
import {
  baseCase,
  checkStatus,
  clarificationState,
  fieldStatus,
  riskOf,
  stages,
  typeOf,
} from "./api-operations-mappers";

function documentState(item: CaseDetail["documents"][number]) {
  if (item.status === "VERIFIED") return "verified" as const;
  if (item.status === "REJECTED") return "rejected" as const;
  if (item.status === "REUPLOAD_REQUIRED") return "reupload_required" as const;
  return item.currentVersion ? ("received" as const) : ("pending" as const);
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
      label: checkLabel(check.type),
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
        status: documentState(item),
        originalName: latest?.originalName ?? null,
        version: item.currentVersion,
        revision: item.version,
        expiresAt: item.expiresAt,
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
          checkLabel: checkLabel(check.type),
          assignedAt: row.updatedAt,
          assignedBy: "Operations",
        })),
    ),
    clarifications,
    fieldVisits,
    fieldEvidence: row.fieldVisits,
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
      ...(row.checks.some((check) => check.type === "ADDRESS") &&
      !row.fieldVisits.some((visit) => visit.status === "COMPLETED")
        ? [
            {
              id: "physical-field",
              tone: "warning" as const,
              label: "Physical address visit required",
              detail:
                "Open full case workspace → Field visits. Assign a Field Executive and obtain supervisor approval before QA.",
            },
          ]
        : []),
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
