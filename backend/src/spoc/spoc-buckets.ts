import {
  activeTaskStatuses,
  settledInvoiceStatuses,
  statusesHeldBy,
  terminalCaseStatuses,
} from "./spoc-holder";
import type { SpocClientFilters } from "./spoc-scope";

/**
 * Single source of truth for the SPOC role matrix. The overview counts and the
 * record drill-down lists both use these where-clauses, so a count always
 * equals the number of records it opens.
 */
export const SpocBuckets = [
  "pending",
  "inProgress",
  "completed",
  "overdue",
  "exceptions",
] as const;
export type SpocBucket = (typeof SpocBuckets)[number];

export interface BucketContext {
  tenantId: bigint;
  /** Tenant-wide case filter incl. client / branch / priority. */
  caseWhere: Record<string, unknown>;
  /** Client scope for non-case rows (opportunities, invoices, clients). */
  clients: SpocClientFilters;
  range: { from: Date; to: Date };
  now: Date;
}

type Where = Record<string, unknown>;

function window(ctx: BucketContext) {
  return { gte: ctx.range.from, lte: ctx.range.to };
}

/** OPS_MANAGER and CLIENT_ADMIN buckets over verification cases. */
export function caseBucket(
  role: "OPS_MANAGER" | "CLIENT_ADMIN",
  bucket: Exclude<SpocBucket, "exceptions">,
  ctx: BucketContext,
): Where {
  const live = { status: { notIn: terminalCaseStatuses } };
  const completed = {
    status: { in: ["COMPLETED", "CLOSED"] },
    completedAt: window(ctx),
  };
  if (role === "OPS_MANAGER") {
    return {
      pending: { ...live, assignedOpsUserId: null },
      inProgress: { ...live, assignedOpsUserId: { not: null } },
      completed,
      overdue: { ...live, dueAt: { lt: ctx.now } },
    }[bucket];
  }
  const clientHeld = statusesHeldBy("CLIENT_ADMIN");
  return {
    pending: {
      status: { in: clientHeld.filter((s) => s !== "CLARIFICATION_PENDING") },
    },
    inProgress: { status: "CLARIFICATION_PENDING" },
    completed,
    overdue: { status: { in: clientHeld }, dueAt: { lt: ctx.now } },
  }[bucket];
}

export function taskBucket(bucket: SpocBucket, ctx: BucketContext): Where {
  return {
    pending: { status: { in: ["UNASSIGNED", "OPEN", "BLOCKED"] } },
    inProgress: { status: "IN_PROGRESS" },
    completed: { status: "COMPLETED", completedAt: window(ctx) },
    overdue: { status: { in: activeTaskStatuses }, dueAt: { lt: ctx.now } },
    exceptions: { status: "BLOCKED" },
  }[bucket];
}

/** QA buckets: pending/in-progress/overdue are cases, completed/exceptions are decisions. */
export function qaBucket(
  bucket: SpocBucket,
  ctx: BucketContext,
): { source: "case"; where: Where } | { source: "review"; where: Where } {
  if (bucket === "completed")
    return {
      source: "review",
      where: { decision: "APPROVED", createdAt: window(ctx) },
    };
  if (bucket === "exceptions")
    return {
      source: "review",
      where: { decision: "REWORK", createdAt: window(ctx) },
    };
  return {
    source: "case",
    where: {
      pending: { status: "QA_REVIEW", qaReviewerId: null },
      inProgress: { status: "QA_REVIEW", qaReviewerId: { not: null } },
      overdue: { status: "QA_REVIEW", dueAt: { lt: ctx.now } },
    }[bucket],
  };
}

export function visitBucket(bucket: SpocBucket, ctx: BucketContext): Where {
  const open = [
    "ASSIGNED",
    "IN_PROGRESS",
    "REVIEW_PENDING",
    "EXCEPTION_REVIEW",
  ];
  return {
    pending: { status: "ASSIGNED" },
    inProgress: {
      status: { in: ["IN_PROGRESS", "REVIEW_PENDING", "EXCEPTION_REVIEW"] },
    },
    completed: { status: "COMPLETED", completedAt: window(ctx) },
    overdue: { status: { in: open }, case: { dueAt: { lt: ctx.now } } },
    exceptions: { status: "EXCEPTION_REVIEW" },
  }[bucket];
}

export function opportunityBucket(
  bucket: SpocBucket,
  ctx: BucketContext,
): Where {
  const open = { stage: { notIn: ["WON", "LOST"] } };
  return {
    pending: { stage: { in: ["NEW", "QUALIFIED"] } },
    inProgress: { stage: { in: ["PROPOSAL", "NEGOTIATION"] } },
    completed: { stage: "WON", closedAt: window(ctx) },
    overdue: { ...open, nextFollowUpAt: { lt: ctx.now } },
    exceptions: { ...open, ownerId: null },
  }[bucket];
}

/** Finance exceptions are credit-hold clients (see the credit_hold exception category). */
export function invoiceBucket(
  bucket: Exclude<SpocBucket, "exceptions">,
  ctx: BucketContext,
): Where {
  const open = { status: { notIn: [...settledInvoiceStatuses, "DRAFT"] } };
  return {
    pending: { status: "ISSUED" },
    inProgress: { status: { in: ["PARTIALLY_PAID", "PARTIALLY_CREDITED"] } },
    completed: {
      status: { in: ["PAID", "SETTLED", "CREDITED"] },
      updatedAt: window(ctx),
    },
    overdue: { ...open, dueAt: { lt: ctx.now } },
  }[bucket];
}
