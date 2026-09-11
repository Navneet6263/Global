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
    client: row.client,
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

export function presentCaseListItem(
  row: CaseRow,
  actor: Actor,
  pii?: SubjectPiiService,
) {
  const common = base(row, safeSubject(row, actor, pii), actor);
  if (
    actor.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role))
  ) {
    return {
      ...common,
      assignedOpsUser: row.assignedOpsUser,
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
      checks: rowList(row.checks).map((check) => {
        const safeCheck = { ...check };
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
