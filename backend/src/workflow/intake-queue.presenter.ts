import type { Prisma } from "../generated/prisma/client";
import { OPEN_CLARIFICATION } from "./workflow-access";

export const intakeSelect = {
  id: true,
  publicId: true,
  caseNumber: true,
  status: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  assignedOpsUserId: true,
  dataEntryUserId: true,
  dataEntryAssignedAt: true,
  dataEntryReadyAt: true,
  branchId: true,
  clientId: true,
} satisfies Prisma.VerificationCaseSelect;

export type IntakeCaseRecord = Prisma.VerificationCaseGetPayload<{
  select: typeof intakeSelect;
}>;

/** Fields every work-queue row needs; nothing private to another role. */
export const queueCaseSelect = {
  publicId: true,
  caseNumber: true,
  status: true,
  priority: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  dataEntryAssignedAt: true,
  dataEntryReadyAt: true,
  escalatedAt: true,
  escalationNote: true,
  subject: { select: { fullName: true } },
  client: { select: { publicId: true, displayName: true } },
  assignedOpsUser: { select: { publicId: true, displayName: true } },
  dataEntryUser: { select: { publicId: true, displayName: true } },
  documents: { select: { status: true } },
  clarifications: {
    where: { status: { in: OPEN_CLARIFICATION } },
    select: { level: true, status: true },
  },
  checks: {
    select: {
      status: true,
      department: { select: { publicId: true, name: true } },
      tasks: {
        where: {
          status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
        },
        select: { status: true, assignee: { select: { displayName: true } } },
      },
    },
  },
} satisfies Prisma.VerificationCaseSelect;

type QueueCase = Prisma.VerificationCaseGetPayload<{
  select: typeof queueCaseSelect;
}>;

export function presentQueueCase(row: QueueCase) {
  const done = row.checks.filter(
    (check) => check.status === "COMPLETED",
  ).length;
  return {
    id: row.publicId,
    caseNumber: row.caseNumber,
    status: row.status,
    priority: row.priority,
    version: row.version,
    workflowVersion: row.workflowVersion,
    intakeStage: row.intakeStage,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    dataEntryAssignedAt: row.dataEntryAssignedAt,
    dataEntryReadyAt: row.dataEntryReadyAt,
    candidateName: row.subject.fullName,
    client: { id: row.client.publicId, name: row.client.displayName },
    escalation: row.escalatedAt
      ? { at: row.escalatedAt, note: row.escalationNote }
      : null,
    rm: row.assignedOpsUser
      ? {
          id: row.assignedOpsUser.publicId,
          name: row.assignedOpsUser.displayName,
        }
      : null,
    dataEntry: row.dataEntryUser
      ? { id: row.dataEntryUser.publicId, name: row.dataEntryUser.displayName }
      : null,
    documents: {
      total: row.documents.length,
      rejected: row.documents.filter(
        (document) => document.status === "REJECTED",
      ).length,
    },
    openInsufficiency: {
      l1: row.clarifications.filter((item) => item.level === "L1").length,
      l2: row.clarifications.filter((item) => item.level !== "L1").length,
    },
    checks: {
      total: row.checks.length,
      completed: done,
      unassigned: row.checks.filter((check) =>
        check.tasks.some((task) => task.status === "UNASSIGNED"),
      ).length,
      departments: [
        ...new Set(
          row.checks.flatMap((check) =>
            check.department ? [check.department.name] : [],
          ),
        ),
      ],
    },
  };
}

const CLOSED_STATUSES = ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"];
export const PRE_CONSENT_STATUSES = ["DRAFT", "CONSENT_PENDING"] as const;
export const RM_EXCLUDED_STATUSES: string[] = [
  ...PRE_CONSENT_STATUSES,
  ...CLOSED_STATUSES,
];

export const SUBMISSION_COMPLETE_AUDIT_ACTIONS = [
  "candidate-portal.completed",
  "case.documents-submitted-for-intake",
  "case.client-review-approved",
  "case.team-documents-completed",
] as const;

/**
 * A case is eligible for the SPOC-RM actual Work Queue only after candidate consent
 * is accepted/persisted and required candidate documents have been submitted.
 * Uses `NOT: [{ intakeStage: { in: ... } }]` so workflow v1 `NULL` rows stay intact.
 */
export const RM_ELIGIBLE_CASE_WHERE: Prisma.VerificationCaseWhereInput = {
  status: { notIn: RM_EXCLUDED_STATUSES },
  consents: { none: { status: { in: ["REQUESTED", "WITHDRAWN"] } } },
  NOT: [
    { intakeStage: { in: ["CANDIDATE_UPLOAD", "CLIENT_RETURNED"] } },
    {
      status: "DOCUMENT_PENDING",
      intakeStage: "INTAKE",
      dataEntryAssignedAt: null,
      dataEntryReadyAt: null,
      candidateAccess: { none: { completedAt: { not: null } } },
    },
  ],
};

export function rmEligibleWhere(
  base: Prisma.VerificationCaseWhereInput,
  ...extra: Array<Prisma.VerificationCaseWhereInput | undefined>
): Prisma.VerificationCaseWhereInput {
  const baseAnd = base.AND
    ? Array.isArray(base.AND)
      ? base.AND
      : [base.AND]
    : [];
  const filteredExtra = extra.filter(
    (entry): entry is Prisma.VerificationCaseWhereInput => Boolean(entry),
  );
  const mergedAnd = [...baseAnd, ...filteredExtra];
  return {
    ...base,
    ...RM_ELIGIBLE_CASE_WHERE,
    ...(mergedAnd.length ? { AND: mergedAnd } : {}),
  };
}

export const RM_BUCKETS: Record<string, Prisma.VerificationCaseWhereInput> = {
  needs_data_entry: { intakeStage: "INTAKE", status: "DOCUMENT_PENDING" },
  with_data_entry: { intakeStage: "DATA_ENTRY" },
  correction: { intakeStage: "CORRECTION" },
  ready: { intakeStage: "READY" },
  in_verification: {
    intakeStage: "ROUTED",
    status: { in: ["IN_PROGRESS", "CLARIFICATION_PENDING"] },
  },
  qc: { status: "QA_REVIEW" },
  final_approval: { status: "MANAGER_REVIEW" },
};

export function searchWhere(search: string): Prisma.VerificationCaseWhereInput {
  const term = search.trim().slice(0, 120);
  return {
    OR: [
      { caseNumber: { contains: term } },
      { externalRef: { contains: term } },
      { subject: { fullName: { contains: term } } },
      { client: { displayName: { contains: term } } },
    ],
  };
}

export function readableTypes(types: readonly string[]) {
  return types
    .map((type) => type.replaceAll("_", " ").toLowerCase())
    .join(", ");
}
