import type { Logger } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { notifyNewVersionForVendorChain } from "../vendor-requests/services/vendor-notify";
import { promoteIntakeAfterTeamUpload } from "../workflow/intake-eligibility.helpers";
import { CANDIDATE_PRIVACY_NOTICE } from "./candidate-privacy-notice";
import { cancelUploadLease, withUploadStorageLease } from "./document-storage-lease";
import {
  computeNextDocumentVersion,
  persistDocumentVersion,
} from "./document-version-writer";
import type { LocalObjectStorageService } from "./local-object-storage.service";
import {
  assertNotDuplicateDocument,
  lockMutableCaseEvidence,
} from "./upload-document-policy";

export interface TeamUploadTarget {
  id: bigint;
  publicId: string;
  type: string;
  status: string;
  currentVersion: number;
  version: number;
  case: { id: bigint; publicId: string; status: string };
  tenant: { publicId: string };
}

export interface CandidateAccessTarget {
  tenantId: bigint;
  tenantPublicId: string;
  caseId: bigint;
  casePublicId: string;
  caseStatus: string;
}

export interface DocumentUploadOptions {
  clarificationId?: bigint;
  preserveVerifiedBaseline?: boolean;
}

export async function executeTeamDocumentUpload(
  deps: {
    prisma: PrismaService;
    storage: LocalObjectStorageService;
    logger: Logger;
  },
  actor: Actor,
  document: TeamUploadTarget,
  file: UploadedBinary,
  options?: DocumentUploadOptions,
) {
  const { prisma, storage, logger } = deps;
  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  await assertNotDuplicateDocument(prisma, actor.tenantId, document.case.id, sha256);
  const versionHint = await computeNextDocumentVersion(
    prisma,
    document.id,
    document.currentVersion,
  );
  const objectKey = `${document.tenant.publicId}/${document.case.publicId}/${document.publicId}/v${versionHint}-${randomUUID()}`;

  const result = await withUploadStorageLease(
    {
      prisma,
      storage,
      logger,
      tenantId: actor.tenantId,
      aggregateId: document.publicId,
      objectKey,
      buffer: file.buffer,
    },
    (leaseId) =>
      prisma.$transaction(async (tx) => {
        await lockMutableCaseEvidence(tx, document.case.id);
        await assertNotDuplicateDocument(tx, actor.tenantId, document.case.id, sha256);
        const { created, version, keepVerifiedBaseline } =
          await persistDocumentVersion(tx, {
            documentId: document.id,
            expectedCurrentVersion: document.currentVersion,
            expectedLockVersion: document.version,
            currentStatus: document.status,
            preserveVerifiedBaseline: Boolean(options?.preserveVerifiedBaseline),
            objectKey,
            originalName: file.originalName,
            contentType: file.mimetype,
            sizeBytes: file.size,
            sha256,
            uploadedById: actor.userId,
            clarificationId: options?.clarificationId,
          });
        await cancelUploadLease(tx, leaseId);
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "document.uploaded",
            resourceType: "document",
            resourcePublicId: document.publicId,
            afterJson: JSON.stringify({ version, sha256, sizeBytes: file.size }),
          },
        });
        if (!keepVerifiedBaseline) {
          await notifyNewVersionForVendorChain(tx, {
            tenantId: actor.tenantId,
            documentId: document.id,
            version,
          });
        }
        await notifyIntakeResubmission(tx, actor.tenantId, document.id, version);
        await promoteIntakeAfterTeamUpload(
          tx,
          actor,
          document.case.id,
          document.case.publicId,
        );
        return created;
      }),
  );
  return { ...result, sizeBytes: result.sizeBytes.toString() };
}

export async function executeCandidateDocumentUpload(
  deps: {
    prisma: PrismaService;
    storage: LocalObjectStorageService;
    logger: Logger;
  },
  access: CandidateAccessTarget,
  type: string,
  file: UploadedBinary,
  expiresAt: Date | null | undefined,
  options?: DocumentUploadOptions,
) {
  const { prisma, storage, logger } = deps;
  const sha256 = createHash("sha256").update(file.buffer).digest("hex");
  await assertNotDuplicateDocument(prisma, access.tenantId, access.caseId, sha256);
  const existing = await prisma.document.findFirst({
    where: { tenantId: access.tenantId, caseId: access.caseId, type },
    orderBy: { createdAt: "desc" },
    select: { id: true, publicId: true, status: true, currentVersion: true, version: true },
  });
  const target =
    existing ??
    (await prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, access.caseId);
      return tx.document.create({
        data: { tenantId: access.tenantId, caseId: access.caseId, type, expiresAt },
        select: { id: true, publicId: true, status: true, currentVersion: true, version: true },
      });
    }));
  const versionHint = await computeNextDocumentVersion(
    prisma,
    target.id,
    target.currentVersion,
  );
  const objectKey = `${access.tenantPublicId}/${access.casePublicId}/${target.publicId}/v${versionHint}-${randomUUID()}`;
  const preserveBaseline = options?.preserveVerifiedBaseline ?? true;

  const saved = await withUploadStorageLease(
    {
      prisma,
      storage,
      logger,
      tenantId: access.tenantId,
      aggregateId: target.publicId,
      objectKey,
      buffer: file.buffer,
    },
    (leaseId) =>
      prisma.$transaction(async (tx) => {
        await lockMutableCaseEvidence(tx, access.caseId);
        await assertNotDuplicateDocument(tx, access.tenantId, access.caseId, sha256);
        const outcome = await persistDocumentVersion(tx, {
          documentId: target.id,
          expectedCurrentVersion: target.currentVersion,
          expectedLockVersion: target.version,
          currentStatus: target.status,
          preserveVerifiedBaseline: preserveBaseline,
          expiresAt: expiresAt ?? null,
          objectKey,
          originalName: file.originalName,
          contentType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          clarificationId: options?.clarificationId,
        });
        await cancelUploadLease(tx, leaseId);
        await tx.auditEvent.create({
          data: {
            tenantId: access.tenantId,
            action: "document.candidate-uploaded",
            resourceType: "document",
            resourcePublicId: target.publicId,
            afterJson: JSON.stringify({
              version: outcome.version,
              sha256,
              sizeBytes: file.size,
              preservedBaseline: outcome.keepVerifiedBaseline,
              privacyNoticeVersion: CANDIDATE_PRIVACY_NOTICE.version,
            }),
          },
        });
        if (!outcome.keepVerifiedBaseline) {
          await notifyNewVersionForVendorChain(tx, {
            tenantId: access.tenantId,
            documentId: target.id,
            version: outcome.version,
          });
        }
        return outcome;
      }),
  );
  return {
    id: target.publicId,
    type,
    version: saved.version,
    sha256,
    malwareState: "CLEAN",
  };
}

async function notifyIntakeResubmission(
  tx: Prisma.TransactionClient,
  tenantId: bigint,
  documentId: bigint,
  version: number,
) {
  if (version <= 1) return;
  const intake = await tx.verificationCase.findFirst({
    where: {
      tenantId,
      documents: { some: { id: documentId } },
      workflowVersion: 2,
      intakeStage: { in: ["DATA_ENTRY", "CORRECTION"] },
      dataEntryUserId: { not: null },
    },
    select: { publicId: true, caseNumber: true, dataEntryUserId: true },
  });
  if (!intake?.dataEntryUserId) return;
  await tx.notification.create({
    data: {
      tenantId,
      userId: intake.dataEntryUserId,
      type: "DOCUMENT_RESUBMITTED",
      title: "Document resubmitted",
      body: `${intake.caseNumber}: a replacement document (v${version}) is ready to review.`,
      href: `/data-entry?caseId=${intake.publicId}`,
    },
  });
}
