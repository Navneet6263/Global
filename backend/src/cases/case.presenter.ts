import { canReadReleasedReport } from "../reports/report-payment-policy";
import type { Actor } from "../common/auth/actor";
import type { SubjectPiiService } from "../common/security/subject-pii.service";

type CaseRow = Record<string, unknown>;

function objectRow(value: unknown): CaseRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CaseRow)
    : {};
}

function rowList(value: unknown): CaseRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is CaseRow =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function serviceScope(row: CaseRow, actor: Actor) {
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
function publicClient(client: unknown) {
  const row = objectRow(client);
  return row.publicId
    ? { publicId: row.publicId, code: row.code, displayName: row.displayName }
    : client;
}

function base(row: CaseRow, subject: unknown, actor: Actor) {
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

function safeSubject(row: CaseRow, actor: Actor, pii?: SubjectPiiService) {
  const stored = objectRow(row.subject);
  const subject = pii ? pii.present(stored) : stored;
  return actor.roles.some((role) =>
    ["FIELD_EXECUTIVE", "VERIFIER"].includes(role),
  )
    ? { id: subject.publicId ?? subject.id, fullName: subject.fullName }
    : subject;
}

function redactTask(task: CaseRow) {
  const { assignee, ...rest } = task;
  const assignedUser = objectRow(assignee);
  return {
    ...rest,
    assignee: Object.keys(assignedUser).length
      ? {
          id: assignedUser.publicId,
          displayName: assignedUser.displayName,
        }
      : null,
  };
}

function verifierChecks(row: CaseRow, actor: Actor): CaseRow[] {
  return rowList(row.checks).flatMap((check) => {
    const tasks = rowList(check.tasks).filter(
      (task) => objectRow(task.assignee).publicId === actor.userPublicId,
    );
    return tasks.length ? [{ ...check, tasks: tasks.map(redactTask) }] : [];
  });
}

function redactVisit(visit: CaseRow) {
  const { assignee, evidence, ...rest } = visit;
  const assignedUser = objectRow(assignee);
  const evidenceItems = rowList(evidence);
  return {
    ...rest,
    assignee: Object.keys(assignedUser).length
      ? {
          id: assignedUser.publicId,
          displayName: assignedUser.displayName,
        }
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

/** Internal v2 flow position. Never returned to Client Admin. */
/**
 * The company's own escalation only (its reason, when). Internal escalations by the
 * Platform Admin or Operations are never shown to the client.
 */
function clientEscalation(row: CaseRow) {
  const note = typeof row.escalationNote === "string" ? row.escalationNote : "";
  if (!row.escalatedAt || !note.startsWith("Client: ")) return null;
  return { at: row.escalatedAt, reason: note.slice("Client: ".length) };
}

function workflow(row: CaseRow) {
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

function withoutDepartment(check: CaseRow) {
  const safe = { ...check };
  delete safe.department;
  delete safe.routedAt;
  delete safe.initiationJson;
  delete safe.initiatedAt;
  return safe;
}

/**
 * The case's report the client can download now (released, access not expired), shown
 * where the case appears as completed. Null until then.
 */
function releasedReport(row: CaseRow) {
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

export function presentCaseListItem(
  row: CaseRow,
  actor: Actor,
  pii?: SubjectPiiService,
) {
  const common = base(row, safeSubject(row, actor, pii), actor);
  // People who run the internal workflow (RM, Data Entry) need its stage even when they
  // also hold a narrower role (e.g. RM + QA, Data Entry + Verifier): the most complete
  // internal view wins, never the narrower one.
  if (
    actor.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY"].includes(role),
    )
  ) {
    return {
      ...common,
      assignedOpsUser: row.assignedOpsUser,
      workflow: workflow(row),
      report: releasedReport(row),
      checks: row.checks,
      fieldVisits: row.fieldVisits,
    };
  }
  if (actor.roles.includes("FIELD_EXECUTIVE")) {
    return {
      ...common,
      fieldVisits: rowList(row.fieldVisits)
        .filter(
          (visit) => objectRow(visit.assignee).publicId === actor.userPublicId,
        )
        .map(redactVisit),
    };
  }
  if (actor.roles.includes("VERIFIER")) {
    return { ...common, checks: verifierChecks(row, actor) };
  }
  if (actor.roles.includes("CLIENT_ADMIN")) {
    return {
      ...common,
      report: releasedReport(row),
      checks: rowList(row.checks).map((check) => {
        const safeCheck = withoutDepartment(check);
        delete safeCheck.tasks;
        delete safeCheck.findings;
        return safeCheck;
      }),
    };
  }
  if (actor.roles.includes("QA_REVIEWER")) {
    return {
      ...common,
      checks: rowList(row.checks).map((check) => ({
        ...check,
        tasks: rowList(check.tasks).map(redactTask),
      })),
      fieldVisits: rowList(row.fieldVisits).map(redactVisit),
    };
  }
  return {
    ...common,
    assignedOpsUser: row.assignedOpsUser,
    workflow: workflow(row),
    checks: row.checks,
    fieldVisits: row.fieldVisits,
  };
}

export function presentCaseDetail(
  row: CaseRow,
  actor: Actor,
  pii?: SubjectPiiService,
) {
  const summary = presentCaseListItem(row, actor, pii);
  if (
    actor.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role))
  ) {
    return {
      ...summary,
      qaReviewer: row.qaReviewer ?? null,
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents: row.documents ?? [],
      clarifications: row.clarifications ?? [],
      qaReviews: row.qaReviews ?? [],
      reports: row.reports ?? [],
      fieldVisits: row.fieldVisits ?? [],
    };
  }
  const safe = {
    ...summary,
    checks: "checks" in summary ? summary.checks : [],
    fieldVisits: "fieldVisits" in summary ? summary.fieldVisits : [],
    statusHistory: [],
    consents: [],
    documents: [],
    clarifications: [],
    qaReviews: [],
    reports: [],
  };
  if (actor.roles.includes("FIELD_EXECUTIVE")) return safe;
  if (actor.roles.includes("SPOC_RM")) {
    // The responsible RM owns final review, so it sees the full internal record.
    return {
      ...safe,
      qaReviewer: row.qaReviewer ?? null,
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents: row.documents ?? [],
      clarifications: row.clarifications ?? [],
      qaReviews: row.qaReviews ?? [],
      reports: row.reports ?? [],
      fieldVisits: rowList(row.fieldVisits).map(redactVisit),
    };
  }
  if (actor.roles.includes("DATA_ENTRY")) {
    // Intake review: documents, consent and correction requests; no findings or reports.
    return {
      ...safe,
      checks: rowList(safe.checks).map((check) => {
        const intakeCheck = { ...check };
        delete intakeCheck.tasks;
        delete intakeCheck.findings;
        return intakeCheck;
      }),
      fieldVisits: [],
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents: row.documents ?? [],
      clarifications: row.clarifications ?? [],
    };
  }
  if (actor.roles.includes("VERIFIER")) {
    return { ...safe, clarifications: row.clarifications ?? [] };
  }
  if (actor.roles.includes("CLIENT_ADMIN")) {
    return {
      ...safe,
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents: rowList(row.documents).map((document) => {
        const safeDocument = { ...document };
        delete safeDocument.versions;
        return {
          ...safeDocument,
          versions: [],
        };
      }),
      clarifications: row.clarifications ?? [],
      reports: row.reports ?? [],
      clientEscalation: clientEscalation(row),
    };
  }
  if (actor.roles.includes("QA_REVIEWER")) {
    return {
      ...safe,
      statusHistory: row.statusHistory,
      consents: row.consents,
      documents: row.documents,
      clarifications: row.clarifications,
      qaReviews: row.qaReviews,
      reports: row.reports,
      fieldVisits: rowList(row.fieldVisits).map(redactVisit),
    };
  }
  return safe;
}
