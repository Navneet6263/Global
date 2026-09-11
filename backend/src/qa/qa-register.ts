import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { QaRegisterQueryDto } from "./dto/qa-register-query.dto";
import { claimCutoff } from "./qa-claim";
import { qaDetailSelect } from "./qa-projection";
import {
  fieldQaWhere,
  physicalFieldIssues,
} from "../field-visits/physical-field-policy";

export function qaScope(actor: Actor): Prisma.VerificationCaseWhereInput {
  return {
    tenantId: actor.tenantId,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
    ...(actor.clientId ? { clientId: actor.clientId } : {}),
  };
}

export function qaSearch(search?: string): Prisma.VerificationCaseWhereInput {
  const term = search?.trim();
  return term
    ? {
        OR: [
          { caseNumber: { contains: term } },
          { subject: { fullName: { contains: term } } },
          { client: { displayName: { contains: term } } },
        ],
      }
    : {};
}

export function qaRegisterWhere(
  actor: Actor,
  query: QaRegisterQueryDto,
  now: Date,
) {
  const cutoff = claimCutoff(now);
  const view: Prisma.VerificationCaseWhereInput =
    query.view === "mine"
      ? { qaReviewerId: actor.userId, qaClaimedAt: { gt: cutoff } }
      : query.view === "available"
        ? {
            OR: [
              { qaReviewerId: null },
              { qaClaimedAt: null },
              { qaClaimedAt: { lte: cutoff } },
            ],
          }
        : query.view === "corrections"
          ? {
              status: "IN_PROGRESS",
              qaReviews: { some: { decision: "REWORK" } },
            }
          : {};
  return {
    AND: [
      qaScope(actor),
      { status: query.view === "corrections" ? "IN_PROGRESS" : "QA_REVIEW" },
      view,
      qaSearch(query.search),
      ...(query.view === "corrections" ? [] : [fieldQaWhere()]),
    ],
  } satisfies Prisma.VerificationCaseWhereInput;
}

export async function readQaRegister(
  prisma: PrismaService,
  actor: Actor,
  query: QaRegisterQueryDto,
) {
  const now = new Date();
  const where = qaRegisterWhere(actor, query, now);
  const base = {
    ...qaScope(actor),
    status: "QA_REVIEW",
    AND: [fieldQaWhere()],
  };
  const [rows, total, awaiting, overdue, highRisk, claimed] = await Promise.all(
    [
      prisma.verificationCase.findMany({
        where,
        select: {
          publicId: true,
          caseNumber: true,
          priority: true,
          dueAt: true,
          version: true,
          status: true,
          createdAt: true,
          qaClaimedAt: true,
          qaReviewer: { select: { publicId: true, displayName: true } },
          subject: { select: { publicId: true, fullName: true } },
          client: { select: { publicId: true, displayName: true } },
          checks: { select: { riskLevel: true, status: true } },
          _count: { select: { documents: true } },
          qaReviews: {
            select: { notes: true },
            where: { decision: "REWORK" },
            orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
            take: 1,
          },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.verificationCase.count({ where }),
      prisma.verificationCase.count({ where: base }),
      prisma.verificationCase.count({ where: { ...base, dueAt: { lt: now } } }),
      prisma.verificationCase.count({
        where: {
          ...base,
          checks: { some: { riskLevel: { in: ["HIGH", "CRITICAL"] } } },
        },
      }),
      prisma.verificationCase.count({
        where: {
          ...base,
          qaReviewerId: { not: null },
          qaClaimedAt: { gt: claimCutoff(now) },
        },
      }),
    ],
  );
  return {
    items: rows.map(({ publicId, checks, _count, qaReviews, ...row }) => ({
      id: publicId,
      ...row,
      checkCount: checks.length,
      completedCheckCount: checks.filter(
        (check) => check.status === "COMPLETED",
      ).length,
      documentCount: _count.documents,
      highestRisk:
        ["CRITICAL", "HIGH", "MEDIUM", "LOW"].find((level) =>
          checks.some((check) => check.riskLevel === level),
        ) ?? null,
      claimActive: Boolean(
        row.qaReviewer && row.qaClaimedAt && row.qaClaimedAt > claimCutoff(now),
      ),
      correctionReason:
        row.status === "IN_PROGRESS" ? (qaReviews[0]?.notes ?? null) : null,
    })),
    total,
    page: query.page,
    pageSize: query.limit,
    summary: { awaiting, overdue, highRisk, claimed },
  };
}

export async function readQaDetail(
  prisma: PrismaService,
  actor: Actor,
  caseId: string,
) {
  const row = await prisma.verificationCase.findFirst({
    where: { AND: [qaScope(actor), { publicId: caseId }] },
    select: { ...qaDetailSelect, status: true },
  });
  if (!row) throw new NotFoundException("Case not found");
  if (row.status !== "QA_REVIEW")
    throw new ConflictException(
      "This case left the review queue. Refresh to see its current stage.",
    );
  const { publicId, ...detail } = row;
  const fieldIssues = physicalFieldIssues(row.checks, row.fieldVisits);
  if (fieldIssues.length) throw new ConflictException(fieldIssues.join("; "));
  return { id: publicId, ...detail };
}
