import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  DOCUMENT_VERSION_REVIEW_STATUSES,
  type DocumentVersionReviewStatus,
} from "../clarifications/clarification-status";

type VersionReader = Pick<PrismaService, "documentVersion"> | Pick<Prisma.TransactionClient, "documentVersion">;

export async function computeNextDocumentVersion(
  db: VersionReader,
  documentId: bigint,
  currentVersion: number,
): Promise<number> {
  if (typeof db.documentVersion?.aggregate === "function") {
    const agg = await db.documentVersion.aggregate({
      where: { documentId },
      _max: { version: true },
    });
    return Math.max(currentVersion, agg._max.version ?? 0) + 1;
  }
  return currentVersion + 1;
}

export interface PersistDocumentVersionInput {
  documentId: bigint;
  expectedCurrentVersion: number;
  expectedLockVersion: number;
  currentStatus: string;
  preserveVerifiedBaseline: boolean;
  expiresAt?: Date | null;
  objectKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  uploadedById?: bigint;
  clarificationId?: bigint;
}

export async function persistDocumentVersion(
  tx: Prisma.TransactionClient,
  input: PersistDocumentVersionInput,
) {
  const version = await computeNextDocumentVersion(
    tx,
    input.documentId,
    input.expectedCurrentVersion,
  );
  const keepVerifiedBaseline =
    input.preserveVerifiedBaseline && input.currentStatus === "VERIFIED";

  const updated = await tx.document.updateMany({
    where: {
      id: input.documentId,
      currentVersion: input.expectedCurrentVersion,
      version: input.expectedLockVersion,
    },
    data: keepVerifiedBaseline
      ? { version: { increment: 1 } }
      : {
          currentVersion: version,
          status: "AVAILABLE",
          version: { increment: 1 },
          reviewedAt: null,
          reviewedById: null,
          reviewNote: null,
          ...(input.expiresAt !== undefined
            ? { expiresAt: input.expiresAt }
            : {}),
        },
  });
  if (updated.count !== 1) {
    throw new ConflictException(
      "A document version was uploaded concurrently; refresh and try again",
    );
  }

  const created = await tx.documentVersion.create({
    data: {
      documentId: input.documentId,
      version,
      objectKey: input.objectKey,
      originalName: input.originalName.slice(0, 255),
      contentType: input.contentType,
      sizeBytes: BigInt(input.sizeBytes),
      sha256: input.sha256,
      malwareState: "CLEAN",
      reviewStatus: "PENDING",
      uploadedById: input.uploadedById ?? null,
      clarificationId: input.clarificationId ?? null,
    },
    select: {
      version: true,
      originalName: true,
      contentType: true,
      sizeBytes: true,
      sha256: true,
      malwareState: true,
      reviewStatus: true,
      createdAt: true,
    },
  });
  return { created, version, keepVerifiedBaseline };
}

export async function recordDocumentVersionReview(
  tx: Prisma.TransactionClient,
  input: {
    documentId: bigint;
    version: number;
    reviewStatus: string;
    reviewNote: string;
    reviewedById: bigint;
    reviewedAt: Date;
  },
): Promise<void> {
  if (
    !(DOCUMENT_VERSION_REVIEW_STATUSES as readonly string[]).includes(
      input.reviewStatus,
    )
  ) {
    throw new ConflictException(`Unsupported review status: ${input.reviewStatus}`);
  }
  const updated = await tx.documentVersion.updateMany({
    where: { documentId: input.documentId, version: input.version },
    data: {
      reviewStatus: input.reviewStatus as DocumentVersionReviewStatus,
      reviewNote: input.reviewNote,
      reviewedById: input.reviewedById,
      reviewedAt: input.reviewedAt,
    },
  });
  if (updated.count !== 1) {
    throw new ConflictException("Document version could not be updated");
  }
}
