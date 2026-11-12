import { ConflictException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { PrismaService } from "../database/prisma.service";
import { recordDocumentVersionReview } from "../documents/document-version-writer";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import type { QaReadinessService } from "../verification/qa-readiness.service";
import { reopenDependentChecksForPromotedVersion } from "../verification/shared-document-dependencies";
import { resumeCaseAfterClarifications } from "./clarification-case-resume.helpers";
import type { ActionableL2Clarification } from "./clarification-l2-reject.helpers";
import { requestClarificationReverification } from "./clarification-reverification";

export async function executeL2CompleteReentry(
  prisma: PrismaService,
  qaReadiness: QaReadinessService,
  actor: Actor,
  clarification: ActionableL2Clarification,
  options: {
    cleanEntries?: Array<Record<string, string>>;
    note?: string;
  },
) {
  const submittedDoc = clarification.submittedDocument!;
  const submittedVersion = clarification.submittedDocumentVersion!;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await lockMutableCaseEvidence(tx, clarification.case.id, true);
    const versionRow = await tx.documentVersion.findFirst({
      where: { documentId: submittedDoc.id, version: submittedVersion },
      select: { malwareState: true, reviewStatus: true },
    });
    if (!versionRow || versionRow.malwareState !== "CLEAN") {
      throw new ConflictException(
        "Submitted document version is missing or unsafe",
      );
    }
    if (versionRow.reviewStatus === "REJECTED") {
      throw new ConflictException(
        "Rejected document versions cannot be promoted; request a fresh upload",
      );
    }
    const gate = await tx.clarification.updateMany({
      where: {
        id: clarification.id,
        tenantId: actor.tenantId,
        level: "L2",
        status: "DATA_ENTRY_PENDING",
        submittedDocumentVersion: submittedVersion,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: now,
        dataEntryReviewedById: actor.userId,
        dataEntryReviewedAt: now,
        dataEntryReviewNote: options.note ?? null,
        reentryCompletedById: actor.userId,
        reentryCompletedAt: now,
        responseTokenHash: null,
        responseTokenExpiresAt: null,
      },
    });
    if (gate.count !== 1) {
      throw new ConflictException(
        "Clarification changed or was already completed; refresh and try again",
      );
    }
    await recordDocumentVersionReview(tx, {
      documentId: submittedDoc.id,
      version: submittedVersion,
      reviewStatus: "VERIFIED",
      reviewNote:
        options.note ??
        `Accepted during Data Entry L2 re-entry (v${submittedVersion})`,
      reviewedById: actor.userId,
      reviewedAt: now,
    });
    // Mark unreviewed older PENDING versions SUPERSEDED without overwriting prior VERIFIED/REJECTED rows.
    await tx.documentVersion.updateMany({
      where: {
        documentId: submittedDoc.id,
        version: { lt: submittedVersion },
        reviewStatus: "PENDING",
      },
      data: { reviewStatus: "SUPERSEDED" },
    });
    await tx.document.update({
      where: { id: submittedDoc.id },
      data: {
        currentVersion: submittedVersion,
        status: "VERIFIED",
        reviewNote:
          options.note ??
          `Accepted via Data Entry L2 re-entry (v${submittedVersion})`,
        reviewedById: actor.userId,
        reviewedAt: now,
        version: { increment: 1 },
      },
    });
    if (clarification.checkId && options.cleanEntries) {
      await tx.caseCheck.update({
        where: { id: clarification.checkId },
        data: {
          initiationJson: JSON.stringify({ entries: options.cleanEntries }),
          initiatedAt: now,
          initiatedById: actor.userId,
        },
      });
    }
    if (clarification.checkId) {
      await requestClarificationReverification(tx, actor, {
        caseId: clarification.case.id,
        checkId: clarification.checkId,
        subject: clarification.subject,
        instructionsPrefix: "All details re-entered by Data Entry",
      });
    }
    const reopenedDependentCount =
      await reopenDependentChecksForPromotedVersion(tx, actor, {
        tenantId: actor.tenantId,
        caseId: clarification.case.id,
        documentPublicId: submittedDoc.publicId,
        documentType: submittedDoc.type,
        promotedVersion: submittedVersion,
        excludeCheckId: clarification.checkId ?? undefined,
        reason:
          options.note ??
          `Shared evidence ${submittedDoc.type} updated to v${submittedVersion} via L2 re-entry`,
      });
    const { caseStatus } = await resumeCaseAfterClarifications(tx, qaReadiness, {
      tenantId: actor.tenantId,
      caseId: clarification.case.id,
      casePublicId: clarification.case.publicId,
      caseStatus: clarification.case.status,
      caseNumber: clarification.case.caseNumber,
      branchId: clarification.case.branchId,
      clientId: clarification.case.clientId,
      workflowVersion: clarification.case.workflowVersion,
      intakeStage: clarification.case.intakeStage,
      dataEntryUserId: clarification.case.dataEntryUserId,
      changedById: actor.userId,
      reason:
        "All candidate L2 clarifications re-entered by Data Entry and returned for verification",
    });
    await tx.clarificationMessage.create({
      data: {
        clarificationId: clarification.id,
        senderUserId: actor.userId,
        senderType: "TEAM",
        body:
          options.note ??
          `All details re-entered by Data Entry (v${submittedVersion} accepted). Check returned to Verifier.`,
      },
    });
    await notifyClarificationStakeholders(tx, {
      tenantId: actor.tenantId,
      branchId: clarification.case.branchId,
      clientId: clarification.case.clientId,
      assignedUserId: clarification.case.assignedOpsUserId,
      raisedById: clarification.raisedById,
      opsReviewedById: clarification.opsReviewedById,
      excludeUserId: actor.userId,
      type: "CLARIFICATION_RESOLVED",
      title: "L2 re-entry completed",
      body: `${clarification.case.caseNumber}: ${clarification.subject} (v${submittedVersion} accepted). Case status: ${caseStatus}.`,
      opsHref: "/operations/clarifications",
      rmHref: "/spoc-rm/work?bucket=correction",
    });
    await tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "clarification.l2-reentry-completed",
        resourceType: "clarification",
        resourcePublicId: clarification.publicId,
        afterJson: JSON.stringify({
          status: "RESOLVED",
          caseStatus,
          promotedVersion: submittedVersion,
          updatedInitiation: Boolean(options.cleanEntries),
          reopenedDependentCount,
          reentryCompletedAt: now,
        }),
      },
    });
    return {
      id: clarification.publicId,
      status: "RESOLVED" as const,
      caseStatus,
      promotedDocumentVersion: submittedVersion,
      reopenedDependentCount,
      reentryCompletedAt: now,
    };
  });
}
