import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../../common/auth/actor";
import { spocScope } from "../../common/auth/access-scope";
import { SecretBoxService } from "../../common/security/secret-box.service";
import { SubjectPiiService } from "../../common/security/subject-pii.service";
import { lockMutableCaseEvidence } from "../../documents/upload-document-policy";
import {
  VendorAssignmentsRepository,
  type VendorTx,
} from "../vendor-assignments.repository";
import type { RequestReuploadDto } from "../vendor-requests.validation";
import { notifyOperationsOfReupload } from "./vendor-notify";
import {
  REUPLOAD_REQUIRED,
  documentLabel,
  latestAttempt,
  nextVendorAction,
  requiredText,
} from "./vendor-rules";

/**
 * SPOC-RM "Re-upload": sends a vendor-rejected document back to the candidate using
 * the existing REUPLOAD_REQUIRED state, which the candidate link and the existing
 * upload flow already understand. The rejected VendorAssignment row is never
 * touched, so the rejection reason and attempt history stay exactly as they were.
 */
@Injectable()
export class RequestReuploadService {
  constructor(
    private readonly repository: VendorAssignmentsRepository,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly pii: SubjectPiiService,
  ) {}

  async request(
    actor: Actor,
    documentPublicId: string,
    input: RequestReuploadDto,
  ) {
    const message = requiredText(input.message, "Message to the candidate");
    return this.repository.serializable(async (tx) => {
      const document = await this.repository.findDocumentForReupload(tx, {
        tenantId: actor.tenantId,
        publicId: documentPublicId,
        case: spocScope(actor),
      });
      if (!document) throw new NotFoundException("Document not found");
      const rejected = latestAttempt(document.vendorAssignments);
      if (rejected?.status !== "REJECTED")
        throw new ConflictException(
          "Re-upload can be requested only after a vendor rejection",
        );
      if (document.status === REUPLOAD_REQUIRED)
        throw new ConflictException(
          "A re-upload has already been requested for this document",
        );
      const next = nextVendorAction(
        document.vendorAssignments,
        document.case.status,
        document.currentVersion > 0,
        document.status,
      );
      if (!next.canRequestReupload)
        throw new ConflictException(
          "The case is in QA review or later; ask Operations to return it before requesting a re-upload",
        );
      if (document.version !== input.version)
        throw new ConflictException("Document changed; refresh and try again");
      await lockMutableCaseEvidence(tx, document.case.id);
      const requestedAt = new Date();
      const updated = await this.repository.markReuploadRequested(
        tx,
        { id: document.id, version: input.version },
        {
          status: REUPLOAD_REQUIRED,
          reviewNote: message,
          reviewedById: actor.userId,
          reviewedAt: requestedAt,
        },
      );
      if (updated.count !== 1)
        throw new ConflictException("Document changed; refresh and try again");
      await this.repository.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "document.reupload-requested",
        resourceType: "document",
        resourcePublicId: document.publicId,
        beforeJson: JSON.stringify({
          status: document.status,
          version: document.version,
        }),
        afterJson: JSON.stringify({
          caseId: document.case.publicId,
          caseNumber: document.case.caseNumber,
          documentVersion: document.currentVersion,
          rejectedAssignmentId: rejected.publicId,
          attempt: rejected.attempt,
          status: REUPLOAD_REQUIRED,
          message,
          requestedAt,
        }),
      });
      await notifyOperationsOfReupload(tx, {
        tenantId: actor.tenantId,
        branchId: document.case.branchId,
        clientId: document.case.clientId,
        assignedOpsUserId: document.case.assignedOpsUserId,
        casePublicId: document.case.publicId,
        caseNumber: document.case.caseNumber,
        documentType: document.type,
      });
      const channel = await this.messageCandidate(tx, actor.tenantId, {
        documentPublicId: document.publicId,
        caseNumber: document.case.caseNumber,
        documentType: document.type,
        subject: document.case.subject,
        message,
      });
      const link = await this.repository.activeCandidateLink(
        tx,
        actor.tenantId,
        document.case.id,
        requestedAt,
      );
      return {
        id: document.publicId,
        status: REUPLOAD_REQUIRED,
        version: document.version + 1,
        requestedAt,
        candidateLink: link
          ? { active: true, expiresAt: link.expiresAt }
          : null,
        candidateMessage: channel,
      };
    });
  }

  /**
   * Existing candidate channel: a sealed outbox notification.requested (email, else
   * SMS). The link token is stored only as a hash, so the message asks the candidate
   * to reopen the secure link they already received. Skipped without contact details.
   */
  private async messageCandidate(
    tx: VendorTx,
    tenantId: bigint,
    input: {
      documentPublicId: string;
      caseNumber: string;
      documentType: string;
      subject: Parameters<SubjectPiiService["open"]>[0];
      message: string;
    },
  ) {
    const contact = this.pii.open(input.subject);
    const channel = contact.email ? "EMAIL" : contact.phone ? "SMS" : null;
    const destination = contact.email ?? contact.phone;
    if (!channel || !destination) return null;
    await this.repository.queueOutbox(tx, {
      tenantId,
      topic: "notification.requested",
      aggregateType: "document",
      aggregateId: input.documentPublicId,
      payloadJson: JSON.stringify({
        secret: this.secretBox.seal({
          channel,
          destination,
          template: "candidate-document-reupload",
          variables: {
            caseNumber: input.caseNumber,
            documentType: documentLabel(input.documentType),
            message: input.message,
            portalOrigin: this.config.getOrThrow<string>("WEB_ORIGIN"),
          },
        }),
      }),
    });
    return channel;
  }
}
