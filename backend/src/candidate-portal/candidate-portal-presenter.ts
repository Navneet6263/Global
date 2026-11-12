import { ConflictException } from "@nestjs/common";
import { checksForDocument } from "../cases/check-requirements";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import type { PrismaService } from "../database/prisma.service";
import { CANDIDATE_PRIVACY_NOTICE } from "../documents/candidate-privacy-notice";
import type { authorizeCandidateAccess } from "./candidate-access-authorizer";
import type { candidateUploadItems } from "./candidate-upload-state";

type AuthorizedAccess = Awaited<ReturnType<typeof authorizeCandidateAccess>>;
type CandidateUploads = ReturnType<typeof candidateUploadItems>;

export function presentCandidatePortalSummary(
  access: AuthorizedAccess,
  requested: string[],
  uploads: CandidateUploads,
  supportRequests: unknown,
) {
  return {
    id: access.publicId,
    expiresAt: access.expiresAt,
    completedAt: access.completedAt,
    privacyNotice: CANDIDATE_PRIVACY_NOTICE,
    case: {
      caseNumber: access.case.caseNumber,
      status: access.case.status,
      candidateName: access.case.subject.fullName,
      clientName: access.case.client.displayName,
      dueAt: access.case.dueAt,
      requiredDocumentTypes: requested,
      uploadItems: uploads.items.map((item) => ({
        ...item,
        forChecks: checksForDocument(
          item.type,
          access.case.checks.map((check) => check.type),
        ),
      })),
      readyToComplete: uploads.complete,
      checks: access.case.checks.map((check) => ({
        type: check.type,
        status: check.status,
      })),
      documents: access.case.documents.map((document) => ({
        type: document.type,
        status: document.status,
        currentVersion: document.currentVersion,
        reviewNote: document.reviewNote,
        expiresAt: document.expiresAt,
      })),
      clarifications: access.case.clarifications.map((item) => ({
        id: item.publicId,
        level: item.level,
        subject: item.subject,
        status: item.status,
        dueAt: item.dueAt,
        requestedDocumentType: item.requestedDocumentType,
        submittedDocumentVersion: item.submittedDocumentVersion,
        submittedDocument: item.submittedDocument
          ? {
              id: item.submittedDocument.publicId,
              type: item.submittedDocument.type,
              status: item.submittedDocument.status,
              currentVersion: item.submittedDocument.currentVersion,
            }
          : null,
        rejectionCount: item.rejectionCount,
        lastRejectedAt: item.lastRejectedAt,
        lastRejectedReason: item.lastRejectedReason,
        opsReviewedAt: item.opsReviewedAt,
        reentryCompletedAt: item.reentryCompletedAt,
        messages: item.messages.map(({ senderType, body, createdAt }) => ({
          sender: senderType,
          body,
          createdAt,
        })),
      })),
      consentStatus: access.case.consents[0]?.status ?? "NOT_REQUESTED",
      reportAvailable: access.case.reports.some(
        (report) => report.status === "PUBLISHED",
      ),
      supportRequests,
    },
  };
}

export async function recordCandidateClarificationResponse(
  prisma: PrismaService,
  access: AuthorizedAccess,
  clarification: { id: bigint; subject: string; publicId: string },
  message: string,
) {
  const respondedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.clarification.updateMany({
      where: { id: clarification.id, caseId: access.caseId, status: "OPEN" },
      data: {
        status: "RESPONDED",
        responseTokenHash: null,
        responseTokenExpiresAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Information request changed; refresh and try again",
      );
    }
    await tx.clarificationMessage.create({
      data: {
        clarificationId: clarification.id,
        senderType: "CANDIDATE",
        body: message.trim(),
      },
    });
    const recipients = await activeOperationsRecipients(tx, {
      tenantId: access.tenantId,
      branchId: access.case.branchId,
      clientId: access.case.clientId,
      assignedUserId: access.case.assignedOpsUserId,
    });
    if (recipients.length) {
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          tenantId: access.tenantId,
          userId: recipient.id,
          type: "CLARIFICATION_RESPONDED",
          title: "Candidate response received",
          body: `${access.case.caseNumber}: ${clarification.subject}`,
          href: `/cases/${access.case.publicId}`,
        })),
      });
    }
    await tx.auditEvent.create({
      data: {
        tenantId: access.tenantId,
        action: "clarification.candidate-responded",
        resourceType: "clarification",
        resourcePublicId: clarification.publicId,
        afterJson: JSON.stringify({ status: "RESPONDED", respondedAt }),
      },
    });
  });
  return { received: true, respondedAt };
}
