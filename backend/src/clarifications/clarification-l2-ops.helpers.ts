import { BadRequestException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";

export function dataEntryBranchScope(actor: Actor) {
  const isPlatformAdmin = actor.roles.includes("PLATFORM_ADMIN");
  return !isPlatformAdmin && actor.branchId
    ? { OR: [{ branchId: actor.branchId }, { branchId: null }] }
    : {};
}

export async function resolveActiveDataEntryUser(
  prisma: PrismaService,
  actor: Actor,
  requestedPublicId?: string,
  existingId?: bigint | null,
) {
  const branchScope = dataEntryBranchScope(actor);
  const baseWhere = {
    tenantId: actor.tenantId,
    status: "ACTIVE",
    userRoles: { some: { role: { code: "DATA_ENTRY" } } },
    ...branchScope,
  };
  const user = requestedPublicId
    ? await prisma.user.findFirst({
        where: { ...baseWhere, publicId: requestedPublicId },
        select: { id: true, publicId: true, displayName: true },
      })
    : existingId
      ? await prisma.user.findFirst({
          where: { ...baseWhere, id: existingId },
          select: { id: true, publicId: true, displayName: true },
        })
      : null;
  if (!user) {
    throw new BadRequestException(
      "Assign an active Data Entry user before handing off this clarification",
    );
  }
  return user;
}

export async function loadL2QueueLookups(
  prisma: PrismaService,
  rows: ReadonlyArray<{ checkId: bigint | null; opsReviewedById: bigint | null }>,
  dataEntryUsers: ReadonlyArray<{
    id: bigint;
    publicId: string;
    displayName: string;
  }>,
) {
  const checkIds = [
    ...new Set(rows.map((r) => r.checkId).filter((id): id is bigint => id != null)),
  ];
  const reviewerIds = [
    ...new Set(
      rows.map((r) => r.opsReviewedById).filter((id): id is bigint => id != null),
    ),
  ];
  const [checks, reviewers] = await Promise.all([
    checkIds.length && typeof prisma.caseCheck?.findMany === "function"
      ? prisma.caseCheck.findMany({
          where: { id: { in: checkIds } },
          select: { id: true, publicId: true, type: true, status: true },
        })
      : Promise.resolve([]),
    reviewerIds.length && typeof prisma.user?.findMany === "function"
      ? prisma.user.findMany({
          where: { id: { in: reviewerIds } },
          select: { id: true, publicId: true, displayName: true },
        })
      : Promise.resolve([]),
  ]);
  const checksById = new Map(checks.map((c) => [c.id, c]));
  const usersById = new Map(dataEntryUsers.map((u) => [u.id, u]));
  for (const r of reviewers) usersById.set(r.id, r);
  return { checksById, usersById };
}

export const L2_OPS_QUEUE_SELECT = {
  publicId: true,
  status: true,
  subject: true,
  level: true,
  checkId: true,
  requestedDocumentType: true,
  submittedDocumentVersion: true,
  opsReviewedById: true,
  opsReviewedAt: true,
  opsReviewNote: true,
  dataEntryReviewedAt: true,
  dataEntryReviewNote: true,
  reentryCompletedAt: true,
  rejectionCount: true,
  lastRejectedAt: true,
  lastRejectedReason: true,
  dueAt: true,
  createdAt: true,
  updatedAt: true,
  case: {
    select: {
      publicId: true,
      caseNumber: true,
      status: true,
      workflowVersion: true,
      intakeStage: true,
      dataEntryUserId: true,
      subject: { select: { publicId: true, fullName: true } },
      client: { select: { publicId: true, displayName: true } },
    },
  },
  submittedDocument: {
    select: {
      publicId: true,
      type: true,
      status: true,
      currentVersion: true,
      versions: {
        select: {
          version: true,
          originalName: true,
          contentType: true,
          sizeBytes: true,
          malwareState: true,
          reviewStatus: true,
          reviewNote: true,
          reviewedAt: true,
          createdAt: true,
        },
        orderBy: { version: "desc" },
      },
    },
  },
  messages: {
    select: { senderType: true, body: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
} as const;

export function presentOpsClarificationItem(
  row: {
    publicId: string;
    status: string;
    subject: string;
    level: string | null;
    checkId: bigint | null;
    requestedDocumentType: string | null;
    submittedDocumentVersion: number | null;
    opsReviewedById?: bigint | null;
    opsReviewedAt: Date | null;
    opsReviewNote: string | null;
    dataEntryReviewedAt: Date | null;
    dataEntryReviewNote: string | null;
    reentryCompletedAt: Date | null;
    rejectionCount: number;
    lastRejectedAt: Date | null;
    lastRejectedReason: string | null;
    dueAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    case: {
      publicId: string;
      caseNumber: string;
      status: string;
      workflowVersion: number;
      intakeStage: string | null;
      dataEntryUserId: bigint | null;
      subject: { publicId: string; fullName: string };
      client: { publicId: string; displayName: string };
    };
    submittedDocument: {
      publicId: string;
      type: string;
      status: string;
      currentVersion: number;
      versions: Array<{
        version: number;
        originalName: string;
        contentType: string;
        sizeBytes: bigint;
        malwareState: string;
        reviewStatus: string;
        reviewNote: string | null;
        reviewedAt: Date | null;
        createdAt: Date;
      }>;
    } | null;
    messages: Array<{ senderType: string; body: string; createdAt: Date }>;
  },
  checksById: ReadonlyMap<
    bigint,
    { id: bigint; publicId: string; type: string; status: string }
  >,
  usersById: ReadonlyMap<
    bigint,
    { id: bigint; publicId: string; displayName: string }
  >,
) {
  const check = row.checkId ? checksById.get(row.checkId) : undefined;
  const deUser = row.case.dataEntryUserId
    ? usersById.get(row.case.dataEntryUserId)
    : undefined;
  const opsReviewer = row.opsReviewedById
    ? usersById.get(row.opsReviewedById)
    : undefined;
  return {
    id: row.publicId,
    status: row.status,
    level: row.level,
    subject: row.subject,
    requestedDocumentType: row.requestedDocumentType,
    submittedDocumentVersion: row.submittedDocumentVersion,
    opsReviewedBy: opsReviewer
      ? { id: opsReviewer.publicId, displayName: opsReviewer.displayName }
      : null,
    opsReviewedAt: row.opsReviewedAt,
    opsReviewNote: row.opsReviewNote,
    dataEntryReviewedAt: row.dataEntryReviewedAt,
    dataEntryReviewNote: row.dataEntryReviewNote,
    reentryCompletedAt: row.reentryCompletedAt,
    rejectionCount: row.rejectionCount,
    lastRejectedAt: row.lastRejectedAt,
    lastRejectedReason: row.lastRejectedReason,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    check: check
      ? { id: check.publicId, type: check.type, status: check.status }
      : null,
    case: {
      id: row.case.publicId,
      caseNumber: row.case.caseNumber,
      status: row.case.status,
      workflowVersion: row.case.workflowVersion,
      intakeStage: row.case.intakeStage,
      dataEntryUser: deUser
        ? { id: deUser.publicId, displayName: deUser.displayName }
        : null,
      subjectName: row.case.subject.fullName,
      clientName: row.case.client.displayName,
    },
    submittedDocument: row.submittedDocument
      ? {
          id: row.submittedDocument.publicId,
          type: row.submittedDocument.type,
          status: row.submittedDocument.status,
          currentVersion: row.submittedDocument.currentVersion,
          versions: row.submittedDocument.versions.map((v) => ({
            ...v,
            sizeBytes: v.sizeBytes.toString(),
          })),
        }
      : null,
    messages: row.messages,
  };
}
