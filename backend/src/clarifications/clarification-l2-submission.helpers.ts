import {
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import type { PrismaService } from "../database/prisma.service";
import { assertCandidateDocumentType } from "../documents/candidate-document-policy";
import { cancelUploadLease } from "../documents/document-storage-lease";
import { persistDocumentVersion } from "../documents/document-version-writer";
import {
  assertNotDuplicateDocument,
  lockMutableCaseEvidence,
} from "../documents/upload-document-policy";
import {
  CHECK_DOCUMENTS,
  verifierDocumentTypes,
} from "../verification/check-documents";

export async function resolveL2TargetDocumentType(
  prisma: PrismaService,
  caseId: bigint,
  checkId: bigint | null,
  requestedType: string | null,
  providedType?: string,
): Promise<string> {
  const provided = providedType?.trim().toUpperCase();
  if (requestedType && provided && provided !== requestedType) {
    throw new BadRequestException(
      `This clarification specifically requires ${requestedType}`,
    );
  }
  const check = checkId
    ? await prisma.caseCheck.findUnique({
        where: { id: checkId },
        select: { type: true },
      })
    : null;
  const candidate =
    requestedType ??
    provided ??
    (check ? CHECK_DOCUMENTS[check.type.toUpperCase()]?.[0] : undefined);
  if (!candidate) {
    throw new BadRequestException("Specify the document type being uploaded");
  }
  await assertCandidateDocumentType(prisma, caseId, candidate);
  if (
    check &&
    candidate !== "OTHER" &&
    !verifierDocumentTypes(check.type).includes(candidate)
  ) {
    throw new BadRequestException(
      `Document type ${candidate} cannot be submitted for ${check.type}`,
    );
  }
  return candidate;
}

export async function executeL2SubmissionTransaction(
  prisma: PrismaService,
  params: {
    tenantId: bigint;
    caseId: bigint;
    casePublicId: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    assignedOpsUserId: bigint | null;
    clarificationId: bigint;
    clarificationPublicId: string;
    subject: string;
    docUuidHint: string;
    targetType: string;
    expiresAt?: Date;
    objectKey: string;
    file: UploadedBinary;
    sha256: string;
    explanation: string;
    leaseId?: bigint;
  },
) {
  const submittedAt = new Date();
  return prisma.$transaction(async (tx) => {
    await lockMutableCaseEvidence(tx, params.caseId);
    await assertNotDuplicateDocument(
      tx,
      params.tenantId,
      params.caseId,
      params.sha256,
    );
    const targetDoc =
      (await tx.document.findFirst({
        where: {
          tenantId: params.tenantId,
          caseId: params.caseId,
          type: params.targetType,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          publicId: true,
          status: true,
          currentVersion: true,
          version: true,
        },
      })) ??
      (await tx.document.create({
        data: {
          publicId: params.docUuidHint,
          tenantId: params.tenantId,
          caseId: params.caseId,
          type: params.targetType,
          status: "AVAILABLE",
          currentVersion: 0,
          expiresAt: params.expiresAt,
        },
        select: {
          id: true,
          publicId: true,
          status: true,
          currentVersion: true,
          version: true,
        },
      }));

    const outcome = await persistDocumentVersion(tx, {
      documentId: targetDoc.id,
      expectedCurrentVersion: targetDoc.currentVersion,
      expectedLockVersion: targetDoc.version,
      currentStatus: targetDoc.status,
      preserveVerifiedBaseline: true,
      expiresAt: params.expiresAt ?? null,
      objectKey: params.objectKey,
      originalName: params.file.originalName,
      contentType: params.file.mimetype,
      sizeBytes: params.file.size,
      sha256: params.sha256,
      clarificationId: params.clarificationId,
    });
    const updated = await tx.clarification.updateMany({
      where: {
        id: params.clarificationId,
        caseId: params.caseId,
        level: "L2",
        status: "OPEN",
      },
      data: {
        status: "CANDIDATE_SUBMITTED",
        submittedDocumentId: targetDoc.id,
        submittedDocumentVersion: outcome.version,
        responseTokenHash: null,
        responseTokenExpiresAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Clarification changed; refresh before submitting again",
      );
    }
    await tx.clarificationMessage.create({
      data: {
        clarificationId: params.clarificationId,
        senderType: "CANDIDATE",
        body: params.explanation,
      },
    });
    await cancelUploadLease(tx, params.leaseId);
    await notifyClarificationStakeholders(tx, {
      tenantId: params.tenantId,
      branchId: params.branchId,
      clientId: params.clientId,
      assignedUserId: params.assignedOpsUserId,
      type: "CLARIFICATION_SUBMITTED",
      title: "Candidate submitted L2 clarification",
      body: `${params.caseNumber}: ${params.subject} (v${outcome.version})`,
      opsHref: `/operations/clarifications`,
      rmHref: `/spoc-rm/work?bucket=correction`,
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: params.tenantId,
        topic: "clarification.responded",
        aggregateType: "clarification",
        aggregateId: params.clarificationPublicId,
        payloadJson: JSON.stringify({
          clarificationId: params.clarificationPublicId,
          documentId: targetDoc.publicId,
          documentVersion: outcome.version,
          submittedAt,
        }),
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: params.tenantId,
        action: "clarification.l2-candidate-submitted",
        resourceType: "clarification",
        resourcePublicId: params.clarificationPublicId,
        afterJson: JSON.stringify({
          status: "CANDIDATE_SUBMITTED",
          documentId: targetDoc.publicId,
          documentType: params.targetType,
          submittedDocumentVersion: outcome.version,
          preservedBaseline: outcome.keepVerifiedBaseline,
          submittedAt,
        }),
      },
    });
    return {
      clarificationId: params.clarificationPublicId,
      status: "CANDIDATE_SUBMITTED" as const,
      documentId: targetDoc.publicId,
      documentType: params.targetType,
      submittedDocumentVersion: outcome.version,
      preservedBaseline: outcome.keepVerifiedBaseline,
      submittedAt,
    };
  });
}
