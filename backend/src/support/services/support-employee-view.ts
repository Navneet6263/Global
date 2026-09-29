import { currentOwner } from "../../spoc/spoc-case-records.service";
import { holderOf, terminalCaseStatuses } from "../../spoc/spoc-holder";
import type { EmployeeRow } from "../support-directory.repository";
import {
  CORRECTION_DOCUMENT_STATUSES,
  caseSupportState,
} from "./support-rules";

/** One employee (candidate case) as the support desk lists it. */
export function toEmployee(row: EmployeeRow, now: Date) {
  const tasks = row.checks.flatMap((check) => check.tasks);
  const blockedTasks = tasks.filter((task) => task.status === "BLOCKED").length;
  const statuses = row.documents.map((document) => document.status);
  const { state, reasons } = caseSupportState(
    {
      status: row.status,
      dueAt: row.dueAt,
      blockedTasks,
      documentStatuses: statuses,
      openClarifications: row.clarifications.length,
    },
    now,
  );
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    candidateName: row.subject.fullName,
    client: { id: row.client.publicId, displayName: row.client.displayName },
    branch: row.branch,
    status: row.status,
    holderRole: holderOf(row.status),
    currentOwner: currentOwner(row),
    priority: row.priority,
    dueAt: row.dueAt,
    overdue: Boolean(
      row.dueAt &&
      row.dueAt < now &&
      !terminalCaseStatuses.includes(row.status),
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    checks: {
      completed: row.checks.filter((check) => check.status === "COMPLETED")
        .length,
      total: row.checks.length,
    },
    documents: {
      uploaded: row.documents.filter((document) => document.currentVersion > 0)
        .length,
      verified: statuses.filter((status) => status === "VERIFIED").length,
      awaitingReview: statuses.filter((status) => status === "AVAILABLE")
        .length,
      needsCorrection: statuses.filter((status) =>
        CORRECTION_DOCUMENT_STATUSES.includes(status),
      ).length,
    },
    openClarifications: row.clarifications.length,
    blockedTasks,
    state,
    exceptionReasons: reasons,
  };
}
