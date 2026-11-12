import { caseDocumentRequirements } from "./check-requirements";
import { tatWorkingDays } from "./working-days";
import type { Actor } from "../common/auth/actor";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import {
  type CaseRow,
  clientClarification,
  clientDocument,
  clientEscalation,
  clientProgress,
  internalDocument,
  objectRow,
  presentBaseCase,
  redactTask,
  redactVisit,
  releasedReport,
  rowList,
  safeSubject,
  verifierChecks,
  withoutDepartment,
  workflowSummary,
} from "./case-presenter.helpers";

export { clientProgress };

export function presentCaseListItem(
  row: CaseRow,
  actor: Actor,
  pii?: SubjectPiiService,
) {
  const common = presentBaseCase(row, safeSubject(row, actor, pii), actor);
  if (
    actor.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER", "SPOC_RM", "DATA_ENTRY"].includes(role),
    )
  ) {
    return {
      ...common,
      assignedOpsUser: row.assignedOpsUser,
      workflow: workflowSummary(row),
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
      dueAt: null,
      clientProgress: clientProgress(row),
      tatWorkingDays: tatWorkingDays(
        rowList(row.services).map((service) => Number(service.tatHours)),
      ),
      report: releasedReport(row),
      checks: rowList(row.checks).map((check) => {
        const safeCheck = withoutDepartment(check);
        delete safeCheck.tasks;
        delete safeCheck.findings;
        delete safeCheck.dueAt;
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
    workflow: workflowSummary(row),
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
  const documents = rowList(row.documents).map(internalDocument);
  if (
    actor.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role))
  ) {
    return {
      ...summary,
      qaReviewer: row.qaReviewer ?? null,
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents,
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
    return {
      ...safe,
      qaReviewer: row.qaReviewer ?? null,
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents,
      clarifications: row.clarifications ?? [],
      qaReviews: row.qaReviews ?? [],
      reports: row.reports ?? [],
      fieldVisits: rowList(row.fieldVisits).map(redactVisit),
    };
  }
  if (actor.roles.includes("DATA_ENTRY")) {
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
      documents,
      clarifications: row.clarifications ?? [],
    };
  }
  if (actor.roles.includes("VERIFIER")) {
    return { ...safe, clarifications: row.clarifications ?? [] };
  }
  if (actor.roles.includes("CLIENT_ADMIN")) {
    return {
      ...safe,
      documentRequirements: caseDocumentRequirements(
        rowList(safe.services).flatMap(
          (service) => (service.requiredDocuments as string[] | undefined) ?? [],
        ),
        rowList(safe.checks).map((check) => String(check.type)),
      ),
      statusHistory: row.statusHistory ?? [],
      consents: row.consents ?? [],
      documents: rowList(row.documents).map(clientDocument),
      clarifications: rowList(row.clarifications).map(clientClarification),
      reports: row.reports ?? [],
      clientEscalation: clientEscalation(row),
    };
  }
  if (actor.roles.includes("QA_REVIEWER")) {
    return {
      ...safe,
      statusHistory: row.statusHistory,
      consents: row.consents,
      documents: row.documents ? documents : row.documents,
      clarifications: row.clarifications,
      qaReviews: row.qaReviews,
      reports: row.reports,
      fieldVisits: rowList(row.fieldVisits).map(redactVisit),
    };
  }
  return safe;
}
