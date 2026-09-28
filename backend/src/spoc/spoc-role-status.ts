import type { PrismaService } from "../database/prisma.service";
import {
  caseBucket,
  invoiceBucket,
  opportunityBucket,
  qaBucket,
  taskBucket,
  visitBucket,
  type BucketContext,
  type SpocBucket,
} from "./spoc-buckets";
import { SpocRoles, type SpocRole } from "./spoc-holder";

export interface SpocRoleStatus {
  role: SpocRole;
  basis: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  exceptions: number;
}

type Counter = (bucket: SpocBucket) => Promise<number>;

const bases: Record<SpocRole, string> = {
  OPS_MANAGER:
    "Active cases by ops ownership; exceptions = field visits awaiting ops review",
  VERIFIER: "Verification tasks; exceptions = blocked tasks",
  QA_REVIEWER:
    "Cases in QA (pending = unclaimed); completed = approvals; exceptions = rework",
  CLIENT_ADMIN: "Cases waiting on the client; exceptions = rejected documents",
  FIELD_EXECUTIVE: "Field visits; overdue = open visit on an overdue case",
  SALES_MANAGER:
    "Opportunities; overdue = follow-up passed; exceptions = no owner",
  FINANCE_MANAGER:
    "Issued invoices (pending = unpaid, in progress = part paid/credited); exceptions = clients on credit hold",
};

async function roleRow(
  role: SpocRole,
  count: Counter,
): Promise<SpocRoleStatus> {
  const [pending, inProgress, completed, overdue, exceptions] =
    await Promise.all([
      count("pending"),
      count("inProgress"),
      count("completed"),
      count("overdue"),
      count("exceptions"),
    ]);
  return {
    role,
    basis: bases[role],
    total: pending + inProgress + completed,
    pending,
    inProgress,
    completed,
    overdue,
    exceptions,
  };
}

/**
 * One row per operational role. `total = pending + inProgress + completed`;
 * `overdue` and `exceptions` are overlays; `completed` counts the selected window.
 */
export function roleStatus(
  prisma: PrismaService,
  ctx: BucketContext,
): Promise<SpocRoleStatus[]> {
  const { tenantId, caseWhere, clientPublicId } = ctx;
  const byClient = clientPublicId
    ? { client: { publicId: clientPublicId } }
    : {};
  const cases = (where: object) =>
    prisma.verificationCase.count({ where: { AND: [caseWhere, where] } });
  const visits = (where: object) =>
    prisma.fieldVisit.count({
      where: { AND: [{ tenantId, case: caseWhere }, where] },
    });
  const counters: Record<SpocRole, Counter> = {
    OPS_MANAGER: (bucket) =>
      bucket === "exceptions"
        ? visits({ status: "EXCEPTION_REVIEW" })
        : cases(caseBucket("OPS_MANAGER", bucket, ctx)),
    CLIENT_ADMIN: (bucket) =>
      bucket === "exceptions"
        ? prisma.document.count({
            where: {
              tenantId,
              case: caseWhere,
              status: { in: ["REJECTED", "REUPLOAD_REQUIRED"] },
            },
          })
        : cases(caseBucket("CLIENT_ADMIN", bucket, ctx)),
    VERIFIER: (bucket) =>
      prisma.checkTask.count({
        where: {
          AND: [
            { tenantId, check: { case: caseWhere } },
            taskBucket(bucket, ctx),
          ],
        },
      }),
    QA_REVIEWER: (bucket) => {
      const target = qaBucket(bucket, ctx);
      return target.source === "case"
        ? cases(target.where)
        : prisma.qaReview.count({
            where: { AND: [{ case: caseWhere }, target.where] },
          });
    },
    FIELD_EXECUTIVE: (bucket) => visits(visitBucket(bucket, ctx)),
    SALES_MANAGER: (bucket) =>
      prisma.salesOpportunity.count({
        where: {
          AND: [{ tenantId, ...byClient }, opportunityBucket(bucket, ctx)],
        },
      }),
    FINANCE_MANAGER: (bucket) =>
      bucket === "exceptions"
        ? prisma.client.count({
            where: {
              tenantId,
              creditHold: true,
              ...(clientPublicId ? { publicId: clientPublicId } : {}),
            },
          })
        : prisma.invoice.count({
            where: {
              AND: [{ tenantId, ...byClient }, invoiceBucket(bucket, ctx)],
            },
          }),
  };
  return Promise.all(SpocRoles.map((role) => roleRow(role, counters[role])));
}
