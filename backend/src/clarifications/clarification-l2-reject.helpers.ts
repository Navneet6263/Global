import { ConflictException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { resolveClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { PrismaService } from "../database/prisma.service";
import { recordDocumentVersionReview } from "../documents/document-version-writer";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import type { Prisma } from "../generated/prisma/client";
import {
  sendInsufficiencyNotice,
  type InsufficiencyDeps,
} from "./insufficiency-notice";

export interface ActionableL2Clarification {
  id: bigint;
  publicId: string;
  subject: string;
  checkId: bigint | null;
  raisedById: bigint | null;
  opsReviewedById: bigint | null;
  rejectionCount: number;
  submittedDocumentVersion: number | null;
  submittedDocument: {
    id: bigint;
    publicId: string;
    type: string;
    status: string;
    currentVersion: number;
  } | null;
  case: {
    id: bigint;
    publicId: string;
    status: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    workflowVersion: number;
    intakeStage: string | null;
    dataEntryUserId: bigint | null;
    assignedOpsUserId: bigint | null;
  };
}

export async function executeL2DocumentRejection(
  prisma: PrismaService,
  actor: Actor,
  clarification: ActionableL2Clarification,
  reason: string,
  noticeDeps?: InsufficiencyDeps,
) {
  const submittedDoc = clarification.submittedDocument!;
  const submittedVersion = clarification.submittedDocumentVersion!;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await lockMutableCaseEvidence(tx, clarification.case.id, true);
    const gate = await tx.clarification.updateMany({
      where: {
        id: clarification.id,
        tenantId: actor.tenantId,
        level: "L2",
        status: "DATA_ENTRY_PENDING",
        submittedDocumentVersion: submittedVersion,
      },
      data: {
        status: "OPEN",
        rejectionCount: { increment: 1 },
        lastRejectedAt: now,
        lastRejectedReason: reason,
        dataEntryReviewedById: actor.userId,
        dataEntryReviewedAt: now,
        dataEntryReviewNote: reason,
      },
    });
    if (gate.count !== 1) {
      throw new ConflictException(
        "Clarification changed or was already reviewed; refresh and try again",
      );
    }
    await recordDocumentVersionReview(tx, {
      documentId: submittedDoc.id,
      version: submittedVersion,
      reviewStatus: "REJECTED",
      reviewNote: reason,
      reviewedById: actor.userId,
      reviewedAt: now,
    });
    // Preserve prior VERIFIED baseline untouched; only mark REUPLOAD_REQUIRED if none existed.
    const hasVerifiedBaseline =
      submittedDoc.status === "VERIFIED" &&
      submittedDoc.currentVersion < submittedVersion;
    if (!hasVerifiedBaseline) {
      await tx.document.update({
        where: { id: submittedDoc.id },
        data: {
          status: "REUPLOAD_REQUIRED",
          reviewNote: reason,
          reviewedById: actor.userId,
          reviewedAt: now,
          version: { increment: 1 },
        },
      });
    }
    await tx.clarificationMessage.create({
      data: {
        clarificationId: clarification.id,
        senderUserId: actor.userId,
        senderType: "TEAM",
        body: `Data Entry rejected submitted v${submittedVersion}: ${reason}`,
      },
    });
    const notice = noticeDeps
      ? await sendInsufficiencyNotice(tx, noticeDeps, {
          tenantId: actor.tenantId,
          caseId: clarification.case.id,
          actorUserId: actor.userId,
          subject: clarification.subject,
          message: reason,
          level: "L2",
        })
      : null;

    await notifyRejectionStakeholders(tx, {
      tenantId: actor.tenantId,
      casePublicId: clarification.case.publicId,
      caseNumber: clarification.case.caseNumber,
      branchId: clarification.case.branchId,
      clientId: clarification.case.clientId,
      assignedOpsUserId: clarification.case.assignedOpsUserId,
      raisedById: clarification.raisedById,
      opsReviewedById: clarification.opsReviewedById,
      checkId: clarification.checkId,
      subject: clarification.subject,
      submittedVersion,
      reason,
    });
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "clarification.l2-document-rejected",
        resourceType: "clarification",
        resourcePublicId: clarification.publicId,
        afterJson: JSON.stringify({
          status: "OPEN",
          rejectedVersion: submittedVersion,
          rejectionCount: clarification.rejectionCount + 1,
          reason,
          preservedVerifiedBaseline: hasVerifiedBaseline,
          ...(notice ? { notice } : {}),
        }),
      },
    });
    return {
      id: clarification.publicId,
      status: "OPEN" as const,
      rejectedVersion: submittedVersion,
      rejectionCount: clarification.rejectionCount + 1,
      lastRejectedAt: now,
      lastRejectedReason: reason,
      preservedVerifiedBaseline: hasVerifiedBaseline,
      notice,
    };
  });
}

async function notifyRejectionStakeholders(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: bigint;
    casePublicId: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    assignedOpsUserId: bigint | null;
    raisedById: bigint | null;
    opsReviewedById: bigint | null;
    checkId: bigint | null;
    subject: string;
    submittedVersion: number;
    reason: string;
  },
) {
  const stakeholders = await resolveClarificationStakeholders(tx, {
    tenantId: input.tenantId,
    branchId: input.branchId,
    clientId: input.clientId,
    assignedUserId: input.assignedOpsUserId,
    raisedById: input.raisedById,
    opsReviewedById: input.opsReviewedById,
  });
  const verifierTask =
    input.checkId && typeof tx.checkTask?.findFirst === "function"
      ? await tx.checkTask.findFirst({
          where: { checkId: input.checkId, assigneeId: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { assigneeId: true },
        })
      : null;
  const rmSet = new Set<bigint>(stakeholders.rmUserIds);
  const opsAndActors = new Set<bigint>(stakeholders.opsUserIds);
  if (input.raisedById && !rmSet.has(input.raisedById))
    opsAndActors.add(input.raisedById);
  if (input.opsReviewedById && !rmSet.has(input.opsReviewedById))
    opsAndActors.add(input.opsReviewedById);
  if (verifierTask?.assigneeId && !rmSet.has(verifierTask.assigneeId))
    opsAndActors.add(verifierTask.assigneeId);
  const body = `${input.caseNumber}: ${input.subject} (v${input.submittedVersion}) returned to candidate: ${input.reason}`.slice(
    0,
    500,
  );
  const rows = [
    ...[...opsAndActors].map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: "CLARIFICATION_DOCUMENT_REJECTED",
      title: "L2 document rejected by Data Entry",
      body,
      href: `/cases/${input.casePublicId}`,
    })),
    ...[...rmSet].map((userId) => ({
      tenantId: input.tenantId,
      userId,
      type: "CLARIFICATION_DOCUMENT_REJECTED",
      title: "L2 document rejected by Data Entry",
      body,
      href: "/spoc-rm/work?bucket=correction",
    })),
  ];
  if (!rows.length) return;
  await tx.notification.createMany({ data: rows });
}
