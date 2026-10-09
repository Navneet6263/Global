import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { issueCandidateLink } from "../candidate-portal/candidate-link";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { ReviewDocumentDto } from "./dto/review-document.dto";
import { caseEvidenceReadiness } from "./evidence-readiness";
import {
  documentExpiry,
  lockMutableCaseEvidence,
} from "./upload-document-policy";
import { documentScope } from "../verification/check-documents";

@Injectable()
export class DocumentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly pii?: SubjectPiiService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async readiness(actor: Actor, casePublicId: string) {
    const record = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: { id: true },
    });
    if (!record) throw new NotFoundException("Case not found");
    return caseEvidenceReadiness(this.prisma, record.id);
  }

  async review(actor: Actor, publicId: string, input: ReviewDocumentDto) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: {
          tenantId: actor.tenantId,
          publicId,
          case: caseAccessScope(actor),
          ...documentScope(actor),
        },
        include: {
          case: {
            select: {
              id: true,
              status: true,
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
          },
          versions: {
            where: { version: input.documentVersion },
            select: { malwareState: true },
          },
        },
      });
      if (!document) throw new NotFoundException("Document not found");
      if (
        [
          "MANAGER_REVIEW",
          "REPORT_PENDING",
          "PAYMENT_PENDING",
          "COMPLETED",
          "CLOSED",
          "CANCELLED",
        ].includes(document.case.status)
      ) {
        throw new ConflictException(
          "Return or reopen the case before changing reviewed evidence",
        );
      }
      if (input.note.trim().length < 5)
        throw new BadRequestException("Record a factual document review note");
      await lockMutableCaseEvidence(tx, document.case.id, true);
      if (
        document.currentVersion !== input.documentVersion ||
        document.version !== input.version
      ) {
        throw new ConflictException(
          "Document changed; reopen it before reviewing",
        );
      }
      if (
        !document.versions.length ||
        document.versions[0]?.malwareState !== "CLEAN"
      ) {
        throw new BadRequestException(
          "A safe uploaded version is required before document review",
        );
      }
      const expiresAt = input.expiresAt
        ? documentExpiry(input.expiresAt.slice(0, 10))
        : document.expiresAt;
      const today = new Date(new Date().toISOString().slice(0, 10));
      if (input.decision === "VERIFIED" && expiresAt && expiresAt < today) {
        throw new BadRequestException("An expired document cannot be accepted");
      }
      const reviewedAt = new Date();
      const updated = await tx.document.updateMany({
        where: {
          id: document.id,
          version: input.version,
          currentVersion: input.documentVersion,
        },
        data: {
          status: input.decision,
          reviewNote: input.note.trim(),
          reviewedById: actor.userId,
          reviewedAt,
          expiresAt,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Document changed during review; refresh");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: `document.${input.decision.toLowerCase()}`,
          resourceType: "document",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            status: document.status,
            version: document.version,
          }),
          afterJson: JSON.stringify({
            caseId: document.case.publicId,
            documentVersion: input.documentVersion,
            status: input.decision,
            note: input.note.trim(),
            expiresAt,
            reviewedAt,
          }),
        },
      });
      // Sent back to the candidate: the old (possibly completed) link is replaced by a
      // fresh one emailed to them. Consent stays recorded and is not asked again.
      let candidateLink: { queued: boolean } | null = null;
      if (
        ["REJECTED", "REUPLOAD_REQUIRED"].includes(input.decision) &&
        this.secretBox &&
        this.pii &&
        this.config
      ) {
        const link = await issueCandidateLink(
          tx,
          {
            secretBox: this.secretBox,
            pii: this.pii,
            webOrigin: this.config.getOrThrow<string>("WEB_ORIGIN"),
          },
          {
            tenantId: actor.tenantId,
            caseId: document.case.id,
            casePublicId: document.case.publicId,
            actorUserId: actor.userId,
            subject: document.case.subject,
            sendNotification: true,
            reason: `${document.type.replaceAll("_", " ").toLowerCase()}: ${input.note.trim()}`,
          },
        );
        candidateLink = { queued: link.delivery.queued };
      }
      return {
        id: publicId,
        candidateLink,
        status: input.decision,
        version: input.version + 1,
        currentVersion: document.currentVersion,
        reviewNote: input.note.trim(),
        expiresAt,
        reviewedAt,
      };
    });
  }
}
