import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import type { PrismaService } from "../database/prisma.service";

type UserSummary = { id: string; displayName: string };

export async function listCaseClarifications(
  prisma: PrismaService,
  actor: Actor,
  casePublicId: string,
) {
  const rows = await prisma.clarification.findMany({
    where: {
      tenantId: actor.tenantId,
      case: { ...caseAccessScope(actor), publicId: casePublicId },
    },
    select: {
      publicId: true,
      status: true,
      subject: true,
      level: true,
      checkId: true,
      requestedDocumentType: true,
      submittedDocumentVersion: true,
      raisedById: true,
      opsReviewedById: true,
      opsReviewedAt: true,
      opsReviewNote: true,
      dataEntryReviewedById: true,
      dataEntryReviewedAt: true,
      dataEntryReviewNote: true,
      reentryCompletedById: true,
      reentryCompletedAt: true,
      rejectionCount: true,
      lastRejectedAt: true,
      lastRejectedReason: true,
      dueAt: true,
      resolvedAt: true,
      createdAt: true,
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
              clarificationId: true,
            },
            orderBy: { version: "desc" },
          },
        },
      },
      messages: {
        select: { senderType: true, body: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const { checksById, usersById } = await loadClarificationLookups(
    prisma,
    rows,
  );
  return {
    items: rows.map((row) => presentCaseClarification(row, checksById, usersById)),
  };
}

async function loadClarificationLookups(
  prisma: PrismaService,
  rows: ReadonlyArray<{
    checkId: bigint | null;
    raisedById: bigint | null;
    opsReviewedById: bigint | null;
    dataEntryReviewedById: bigint | null;
    reentryCompletedById: bigint | null;
  }>,
) {
  const checkIds = [
    ...new Set(
      rows.map((r) => r.checkId).filter((id): id is bigint => id != null),
    ),
  ];
  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [
          r.raisedById,
          r.opsReviewedById,
          r.dataEntryReviewedById,
          r.reentryCompletedById,
        ])
        .filter((id): id is bigint => id != null),
    ),
  ];

  const [checks, users] = await Promise.all([
    checkIds.length && typeof prisma.caseCheck?.findMany === "function"
      ? prisma.caseCheck.findMany({
          where: { id: { in: checkIds } },
          select: { id: true, publicId: true, type: true, status: true },
        })
      : Promise.resolve([]),
    userIds.length && typeof prisma.user?.findMany === "function"
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, publicId: true, displayName: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    checksById: new Map(checks.map((c) => [c.id, c])),
    usersById: new Map(
      users.map((u) => [u.id, { id: u.publicId, displayName: u.displayName }]),
    ),
  };
}

function presentCaseClarification(
  row: {
    publicId: string;
    status: string;
    subject: string;
    level: string | null;
    checkId: bigint | null;
    requestedDocumentType: string | null;
    submittedDocumentVersion: number | null;
    raisedById: bigint | null;
    opsReviewedById: bigint | null;
    opsReviewedAt: Date | null;
    opsReviewNote: string | null;
    dataEntryReviewedById: bigint | null;
    dataEntryReviewedAt: Date | null;
    dataEntryReviewNote: string | null;
    reentryCompletedById: bigint | null;
    reentryCompletedAt: Date | null;
    rejectionCount: number;
    lastRejectedAt: Date | null;
    lastRejectedReason: string | null;
    dueAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
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
        clarificationId: bigint | null;
      }>;
    } | null;
    messages: Array<{ senderType: string; body: string; createdAt: Date }>;
  },
  checksById: ReadonlyMap<
    bigint,
    { id: bigint; publicId: string; type: string; status: string }
  >,
  usersById: ReadonlyMap<bigint, UserSummary>,
) {
  const check = row.checkId ? checksById.get(row.checkId) : undefined;
  return {
    id: row.publicId,
    status: row.status,
    subject: row.subject,
    level: row.level,
    checkId: check?.publicId ?? null,
    checkType: check?.type ?? null,
    checkStatus: check?.status ?? null,
    requestedDocumentType: row.requestedDocumentType,
    submittedDocumentVersion: row.submittedDocumentVersion,
    submittedDocument: row.submittedDocument
      ? {
          id: row.submittedDocument.publicId,
          type: row.submittedDocument.type,
          status: row.submittedDocument.status,
          currentVersion: row.submittedDocument.currentVersion,
          versions: row.submittedDocument.versions.map((v) => ({
            version: v.version,
            originalName: v.originalName,
            contentType: v.contentType,
            sizeBytes: v.sizeBytes.toString(),
            malwareState: v.malwareState,
            reviewStatus: v.reviewStatus,
            reviewNote: v.reviewNote,
            reviewedAt: v.reviewedAt,
            createdAt: v.createdAt,
          })),
        }
      : null,
    raisedBy: row.raisedById ? (usersById.get(row.raisedById) ?? null) : null,
    opsReviewedBy: row.opsReviewedById
      ? (usersById.get(row.opsReviewedById) ?? null)
      : null,
    opsReviewedAt: row.opsReviewedAt,
    opsReviewNote: row.opsReviewNote,
    dataEntryReviewedBy: row.dataEntryReviewedById
      ? (usersById.get(row.dataEntryReviewedById) ?? null)
      : null,
    dataEntryReviewedAt: row.dataEntryReviewedAt,
    dataEntryReviewNote: row.dataEntryReviewNote,
    reentryCompletedBy: row.reentryCompletedById
      ? (usersById.get(row.reentryCompletedById) ?? null)
      : null,
    reentryCompletedAt: row.reentryCompletedAt,
    rejectionCount: row.rejectionCount,
    lastRejectedAt: row.lastRejectedAt,
    lastRejectedReason: row.lastRejectedReason,
    dueAt: row.dueAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    messages: row.messages,
  };
}
