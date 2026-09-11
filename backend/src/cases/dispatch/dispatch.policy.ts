import {
  documentReadiness,
  requiredDocumentTypes,
} from "../../documents/evidence-readiness";
import type { Prisma } from "../../generated/prisma/client";
import {
  ACTIVE_TASK_STATUSES,
  MOVABLE_TASK_STATUSES,
} from "../../verification/bulk-task-assignment.helpers";

export const dispatchCaseSelect = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  version: true,
  branchId: true,
  clientId: true,
  dueAt: true,
  subject: { select: { fullName: true } },
  branch: { select: { publicId: true, name: true } },
  client: { select: { publicId: true, displayName: true } },
  consents: { where: { status: "ACCEPTED" }, select: { id: true }, take: 1 },
  documents: {
    select: {
      type: true,
      status: true,
      currentVersion: true,
      expiresAt: true,
      createdAt: true,
    },
  },
  services: { select: { requiredDocumentsJson: true } },
  checks: {
    orderBy: { publicId: "asc" },
    select: {
      id: true,
      publicId: true,
      type: true,
      status: true,
      version: true,
      tasks: {
        where: { status: { in: ACTIVE_TASK_STATUSES } },
        select: {
          id: true,
          publicId: true,
          status: true,
          version: true,
          assigneeId: true,
          assignee: { select: { publicId: true, displayName: true } },
        },
      },
    },
  },
} satisfies Prisma.VerificationCaseSelect;

export type DispatchCase = Prisma.VerificationCaseGetPayload<{
  select: typeof dispatchCaseSelect;
}>;
export type DispatchCheck = DispatchCase["checks"][number];

export function unassignedCheck(check: DispatchCheck) {
  if (check.status === "COMPLETED") return false;
  if (!check.tasks.length) return check.status === "PENDING";
  return (
    check.tasks.length === 1 &&
    !check.tasks[0]!.assigneeId &&
    MOVABLE_TASK_STATUSES.includes(check.tasks[0]!.status)
  );
}

export function dispatchIssues(record: DispatchCase, now = new Date()) {
  const issues: string[] = [];
  if (!["DOCUMENT_PENDING", "IN_PROGRESS"].includes(record.status))
    issues.push(
      "Complete consent/document preparation first; only document-pending or active cases can be dispatched",
    );
  if (!record.consents.length)
    issues.push("Candidate consent has not been accepted");
  try {
    const types = [
      ...new Set(
        record.services.flatMap((service) =>
          requiredDocumentTypes(service.requiredDocumentsJson),
        ),
      ),
    ];
    issues.push(...documentReadiness(types, record.documents, now).issues);
  } catch {
    issues.push(
      "Required-document policy is invalid; ask an administrator to correct it",
    );
  }
  if (record.checks.some((check) => check.tasks.length > 1))
    issues.push(
      "Conflicting active tasks found; resolve in Assignment Workbench",
    );
  const available = record.checks.filter(unassignedCheck);
  if (!available.length)
    issues.push(
      "No unassigned checks remain; use Assignment Workbench for reassignment",
    );
  if (available.length > 50)
    issues.push(
      "More than 50 checks: use the individual workflow and Assignment Workbench",
    );
  return issues;
}

export function matchesVerifier(
  record: Pick<DispatchCase, "branchId" | "clientId">,
  verifier: { branchId: bigint | null; clientId: bigint | null },
) {
  return (
    (!verifier.branchId || verifier.branchId === record.branchId) &&
    (!verifier.clientId || verifier.clientId === record.clientId)
  );
}

export function presentDispatchCase(record: DispatchCase) {
  const issues = dispatchIssues(record);
  return {
    id: record.publicId,
    caseNumber: record.caseNumber,
    candidateName: record.subject.fullName,
    clientName: record.client.displayName,
    branchName: record.branch?.name ?? "No branch",
    version: record.version,
    status: record.status,
    ready: !issues.length,
    issues,
    checks: record.checks.filter(unassignedCheck).map((check) => ({
      id: check.publicId,
      type: check.type,
      checkVersion: check.version,
      ...(check.tasks[0]
        ? { taskId: check.tasks[0].publicId, version: check.tasks[0].version }
        : {}),
    })),
  };
}
