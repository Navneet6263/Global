import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { DocumentsService } from "../documents/documents.service";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { caseEvidenceReadiness } from "../documents/evidence-readiness";
import { CANDIDATE_PRIVACY_NOTICE } from "../documents/candidate-privacy-notice";
import { RequesterSupportRequestsService } from "../support/services/requester-support-requests.service";
import { authorizeCandidateAccess } from "./candidate-access-authorizer";
import { issueCandidateLink } from "./candidate-link";
import { applyIntakeRules } from "../workflow/intake-rules";
import {
  candidateRequestedTypes,
  candidateUploadItems,
} from "./candidate-upload-state";

@Injectable()
export class CandidatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly pii: SubjectPiiService,
    private readonly supportRequests: RequesterSupportRequestsService,
  ) {}

  async issue(actor: Actor, casePublicId: string, sendNotification = true) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: {
        ...caseAccessScope(actor),
        publicId: casePublicId,
      },
      select: {
        id: true,
        publicId: true,
        subject: {
          select: {
            email: true,
            phone: true,
            employeeCode: true,
            piiCiphertext: true,
            piiKeyVersion: true,
          },
        },
      },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    return this.prisma.$transaction((tx) =>
      issueCandidateLink(tx, this.linkDeps(), {
        tenantId: actor.tenantId,
        caseId: verificationCase.id,
        casePublicId,
        actorUserId: actor.userId,
        subject: verificationCase.subject,
        sendNotification,
      }),
    );
  }

  async get(publicId: string, token: string) {
    const access = await authorizeCandidateAccess(
      this.prisma,
      publicId,
      token,
      {
        allowCompleted: true,
      },
    );
    await this.prisma.candidatePortalAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: new Date() },
    });
    const supportRequests = await this.supportRequests.forCandidate(
      access.tenantId,
      access.caseId,
    );
    const requiredTypes = (
      await caseEvidenceReadiness(this.prisma, access.caseId, {
        includeWork: false,
      })
    ).requiredTypes;
    const requested = candidateRequestedTypes(
      requiredTypes,
      access.case.checks,
    );
    const uploads = candidateUploadItems(requested, access.case.documents);
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
        uploadItems: uploads.items,
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
          subject: item.subject,
          status: item.status,
          dueAt: item.dueAt,
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

  /**
   * "I have uploaded all documents": only when every requested document is in. The link
   * closes; if the team later needs something again, a new link is emailed.
   */
  async complete(publicId: string, token: string) {
    const access = await authorizeCandidateAccess(this.prisma, publicId, token);
    const requiredTypes = (
      await caseEvidenceReadiness(this.prisma, access.caseId, {
        includeWork: false,
      })
    ).requiredTypes;
    const requested = candidateRequestedTypes(
      requiredTypes,
      access.case.checks,
    );
    const uploads = candidateUploadItems(requested, access.case.documents);
    if (!uploads.complete) {
      const missing = uploads.items
        .filter((item) => item.state === "NEEDED" || item.state === "REUPLOAD")
        .map((item) => item.type.replaceAll("_", " ").toLowerCase());
      throw new ConflictException(`Upload these first: ${missing.join(", ")}`);
    }
    const completedAt = new Date();
    const next = await this.prisma.$transaction(async (tx) => {
      const closed = await tx.candidatePortalAccess.updateMany({
        where: { id: access.id, revokedAt: null, completedAt: null },
        data: { completedAt, revokedAt: completedAt },
      });
      if (!closed.count)
        throw new ConflictException("This link is already closed");
      await tx.auditEvent.create({
        data: {
          tenantId: access.tenantId,
          action: "candidate-portal.completed",
          resourceType: "case",
          resourcePublicId: access.case.publicId,
          afterJson: JSON.stringify({
            accessId: access.publicId,
            completedAt,
            documents: uploads.items.map((item) => item.type),
          }),
        },
      });
      const recipients = await activeOperationsRecipients(tx, {
        tenantId: access.tenantId,
        branchId: access.case.branchId,
        clientId: access.case.clientId,
        assignedUserId: access.case.assignedOpsUserId,
      });
      const userIds = new Set(recipients.map((recipient) => recipient.id));
      if (access.case.dataEntryUserId) userIds.add(access.case.dataEntryUserId);
      if (userIds.size)
        await tx.notification.createMany({
          data: [...userIds].map((userId) => ({
            tenantId: access.tenantId,
            userId,
            type: "CANDIDATE_COMPLETED",
            title: "Candidate finished uploading",
            body: `${access.case.caseNumber}: ${access.case.subject.fullName} uploaded all requested documents.`,
            href: `/cases/${access.case.publicId}`,
          })),
        });
      // Route A (client reviews first) or the client's auto Data Entry rule.
      return applyIntakeRules(tx, access.caseId);
    });
    return { completed: true, completedAt, next };
  }

  private linkDeps() {
    return {
      secretBox: this.secretBox,
      pii: this.pii,
      webOrigin: this.config.getOrThrow<string>("WEB_ORIGIN"),
    };
  }

  async upload(
    publicId: string,
    token: string,
    type: string,
    file: UploadedBinary,
    expiry?: string,
    noticeVersion?: string,
  ) {
    const access = await authorizeCandidateAccess(this.prisma, publicId, token);
    const consent = access.case.consents[0]?.status;
    if (consent && consent !== "ACCEPTED")
      throw new ConflictException(
        "Confirm your consent with the one-time code before uploading",
      );
    if (noticeVersion !== CANDIDATE_PRIVACY_NOTICE.version) {
      throw new ConflictException(
        "Read and acknowledge the current privacy notice before uploading",
      );
    }
    return this.documents.uploadForCandidate(
      {
        tenantId: access.tenantId,
        tenantPublicId: access.tenant.publicId,
        caseId: access.caseId,
        casePublicId: access.case.publicId,
        caseStatus: access.case.status,
      },
      type.trim().toUpperCase(),
      file,
      expiry,
    );
  }

  async respondToClarification(
    accessPublicId: string,
    token: string,
    clarificationPublicId: string,
    message: string,
  ) {
    const access = await authorizeCandidateAccess(
      this.prisma,
      accessPublicId,
      token,
    );
    const clarification = access.case.clarifications.find(
      (item) => item.publicId === clarificationPublicId,
    );
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (clarification.status !== "OPEN") {
      throw new ConflictException(
        "Only an open information request can receive a response",
      );
    }
    const respondedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
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
          resourcePublicId: clarificationPublicId,
          afterJson: JSON.stringify({ status: "RESPONDED", respondedAt }),
        },
      });
    });
    return { received: true, respondedAt };
  }
}
