import type { Actor } from "../common/auth/actor";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import { canReadReleasedReport } from "../reports/report-payment-policy";
import {
  type CaseRow,
  clientClarification,
  clientDocument,
  clientEscalation,
  clientProgress,
  objectRow,
  rowList,
} from "./case-client-presenter.helpers";

export type { CaseRow };
export {
  clientClarification,
  clientDocument,
  clientEscalation,
  clientProgress,
  objectRow,
  rowList,
};

export function verifierChecks(row: CaseRow, actor: Actor): CaseRow[] {
  return rowList(row.checks).flatMap((check) => {
    const tasks = rowList(check.tasks).filter(
      (task) => objectRow(task.assignee).publicId === actor.userPublicId,
    );
    return tasks.length ? [{ ...check, tasks: tasks.map(redactTask) }] : [];
  });
}

export function serviceScope(row: CaseRow, actor: Actor) {
  const privileged = actor.roles.some((role) =>
    ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
  );
  const fieldOnly = !privileged && actor.roles.includes("FIELD_EXECUTIVE");
  const verifierOnly =
    !privileged && !fieldOnly && actor.roles.includes("VERIFIER");
  const visibleChecks = new Set(
    verifierOnly
      ? verifierChecks(row, actor).map((check) => check.publicId)
      : [],
  );
  return rowList(row.services).map(
    ({ requiredDocumentsJson, checks, ...service }) => ({
      ...service,
      checks: fieldOnly
        ? []
        : verifierOnly
          ? rowList(checks).filter((check) => visibleChecks.has(check.publicId))
          : checks,
      requiredDocuments:
        typeof requiredDocumentsJson === "string"
          ? (JSON.parse(requiredDocumentsJson) as string[])
          : [],
    }),
  );
}

/** Client identity only; the company RM stays internal (workflow.companyRm). */
export function publicClient(client: unknown) {
  const row = objectRow(client);
  return row.publicId
    ? { publicId: row.publicId, code: row.code, displayName: row.displayName }
    : client;
}

export function presentBaseCase(row: CaseRow, subject: unknown, actor: Actor) {
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    externalRef: row.externalRef,
    status: row.status,
    priority: row.priority,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    riskLevel: row.riskLevel,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    subject,
    client: publicClient(row.client),
    servicePackage: row.servicePackage,
    services: serviceScope(row, actor),
    branch: row.branch,
  };
}

export function safeSubject(row: CaseRow, actor: Actor, pii?: SubjectPiiService) {
  const stored = objectRow(row.subject);
  const subject = pii ? pii.present(stored) : stored;
  return actor.roles.some((role) =>
    ["FIELD_EXECUTIVE", "VERIFIER"].includes(role),
  )
    ? { id: subject.publicId ?? subject.id, fullName: subject.fullName }
    : subject;
}

export function redactTask(task: CaseRow) {
  const { assignee, ...rest } = task;
  const assignedUser = objectRow(assignee);
  return {
    ...rest,
    assignee: Object.keys(assignedUser).length
      ? { id: assignedUser.publicId, displayName: assignedUser.displayName }
      : null,
  };
}

export function redactVisit(visit: CaseRow) {
  const { assignee, evidence, ...rest } = visit;
  const assignedUser = objectRow(assignee);
  const evidenceItems = rowList(evidence);
  return {
    ...rest,
    assignee: Object.keys(assignedUser).length
      ? { id: assignedUser.publicId, displayName: assignedUser.displayName }
      : null,
    ...(Array.isArray(evidence)
      ? {
          evidence: evidenceItems.map((item) => ({
            id: item.publicId,
            type: item.type,
            capturedAt: item.capturedAt,
          })),
        }
      : {}),
  };
}

export function internalDocument(document: CaseRow) {
  if (!Array.isArray(document.versions)) return document;
  return {
    ...document,
    versions: rowList(document.versions).map((version) => {
      const { clarification, ...rest } = version;
      const clarificationPublicId = objectRow(clarification).publicId;
      return {
        ...rest,
        clarificationId:
          typeof clarificationPublicId === "string"
            ? clarificationPublicId
            : null,
      };
    }),
  };
}

export function workflowSummary(row: CaseRow) {
  const dataEntry = objectRow(row.dataEntryUser);
  const escalatedBy = objectRow(row.escalatedBy);
  const companyRm = objectRow(objectRow(row.client).primaryRm);
  return {
    version: row.workflowVersion ?? 1,
    intakeStage: row.intakeStage ?? null,
    dataEntryAssignedAt: row.dataEntryAssignedAt ?? null,
    dataEntryReadyAt: row.dataEntryReadyAt ?? null,
    stoppedFromStatus: row.stoppedFromStatus ?? null,
    stoppedAt: row.stoppedAt ?? null,
    stopReason: row.stopReason ?? null,
    escalatedAt: row.escalatedAt ?? null,
    escalationNote: row.escalationNote ?? null,
    escalatedBy: escalatedBy.publicId
      ? { publicId: escalatedBy.publicId, displayName: escalatedBy.displayName }
      : null,
    companyRm: companyRm.publicId
      ? { publicId: companyRm.publicId, displayName: companyRm.displayName }
      : null,
    dataEntryUser: dataEntry.publicId
      ? { publicId: dataEntry.publicId, displayName: dataEntry.displayName }
      : null,
  };
}

export function withoutDepartment(check: CaseRow) {
  const safe = { ...check };
  delete safe.department;
  delete safe.routedAt;
  delete safe.initiationJson;
  delete safe.initiatedAt;
  return safe;
}

export function releasedReport(row: CaseRow) {
  const now = new Date();
  const report = rowList(row.reports).find((item) =>
    canReadReleasedReport(
      {
        status: String(item.status),
        workflowVersion: Number(item.workflowVersion ?? 2),
        releasedAt: (item.releasedAt as Date | null | undefined) ?? null,
        downloadExpiresAt:
          (item.downloadExpiresAt as Date | null | undefined) ?? null,
      },
      now,
    ),
  );
  return report
    ? {
        id: report.publicId,
        version: report.currentVersion,
        releasedAt: report.releasedAt ?? report.publishedAt ?? null,
        downloadExpiresAt: report.downloadExpiresAt ?? null,
      }
    : null;
}
