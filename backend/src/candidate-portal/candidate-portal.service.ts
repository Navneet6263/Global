import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
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

@Injectable()
export class CandidatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly pii: SubjectPiiService,
  ) {}

  async issue(actor: Actor, casePublicId: string) {
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
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 86_400_000);
    const destination = this.pii.open(verificationCase.subject);
    const channel = destination.email
      ? "EMAIL"
      : destination.phone
        ? "SMS"
        : undefined;
    const address = destination.email ?? destination.phone;
    const access = await this.prisma.$transaction(async (tx) => {
      await tx.candidatePortalAccess.updateMany({
        where: { caseId: verificationCase.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const created = await tx.candidatePortalAccess.create({
        data: {
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          tokenHash: this.digest(token),
          expiresAt,
        },
        select: { publicId: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "candidate-portal.access-issued",
          resourceType: "case",
          resourcePublicId: casePublicId,
          afterJson: JSON.stringify({ accessId: created.publicId, expiresAt }),
        },
      });
      if (channel && address) {
        await tx.outboxEvent.create({
          data: {
            tenantId: actor.tenantId,
            topic: "candidate.access.issued",
            aggregateType: "candidate-portal-access",
            aggregateId: created.publicId,
            payloadJson: JSON.stringify({
              secret: this.secretBox.seal({
                accessId: created.publicId,
                channel,
                destination: address,
                portalUrl: `${this.config.getOrThrow<string>("WEB_ORIGIN")}/candidate/${created.publicId}#token=${encodeURIComponent(token)}`,
                expiresAt,
              }),
            }),
          },
        });
      }
      return created;
    });
    return {
      id: access.publicId,
      token,
      expiresAt,
      delivery:
        channel && address
          ? { queued: true, channel, destination: this.mask(address, channel) }
          : { queued: false },
    };
  }

  async get(publicId: string, token: string) {
    const access = await this.authorize(publicId, token);
    await this.prisma.candidatePortalAccess.update({
      where: { id: access.id },
      data: { lastAccessedAt: new Date() },
    });
    return {
      id: access.publicId,
      expiresAt: access.expiresAt,
      privacyNotice: CANDIDATE_PRIVACY_NOTICE,
      case: {
        caseNumber: access.case.caseNumber,
        status: access.case.status,
        candidateName: access.case.subject.fullName,
        clientName: access.case.client.displayName,
        dueAt: access.case.dueAt,
        requiredDocumentTypes: (
          await caseEvidenceReadiness(this.prisma, access.caseId, {
            includeWork: false,
          })
        ).requiredTypes,
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
      },
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
    const access = await this.authorize(publicId, token);
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

  private mask(value: string, channel: "EMAIL" | "SMS") {
    if (channel === "SMS")
      return `${value.slice(0, 3)}******${value.slice(-2)}`;
    const [name, domain] = value.split("@");
    return `${(name ?? "candidate").slice(0, 2)}***@${domain ?? "hidden"}`;
  }

  async respondToClarification(
    accessPublicId: string,
    token: string,
    clarificationPublicId: string,
    message: string,
  ) {
    const access = await this.authorize(accessPublicId, token);
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

  private async authorize(publicId: string, token: string) {
    const access = await this.prisma.candidatePortalAccess.findUnique({
      where: { publicId },
      include: {
        tenant: { select: { publicId: true } },
        case: {
          include: {
            subject: { select: { fullName: true } },
            client: { select: { displayName: true } },
            checks: {
              select: { type: true, status: true },
              orderBy: { createdAt: "asc" },
            },
            documents: {
              select: {
                type: true,
                status: true,
                currentVersion: true,
                reviewNote: true,
                expiresAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
            clarifications: {
              select: {
                id: true,
                publicId: true,
                subject: true,
                status: true,
                dueAt: true,
                messages: {
                  select: { senderType: true, body: true, createdAt: true },
                  orderBy: { createdAt: "asc" },
                },
              },
              orderBy: { createdAt: "desc" },
            },
            consents: {
              select: { status: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            reports: { select: { status: true } },
          },
        },
      },
    });
    if (!access || access.revokedAt || access.expiresAt <= new Date())
      throw new UnauthorizedException(
        "Candidate access link is invalid or expired",
      );
    const expected = Buffer.from(access.tokenHash);
    const actual = Buffer.from(this.digest(token));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      throw new UnauthorizedException(
        "Candidate access link is invalid or expired",
      );
    return access;
  }

  private digest(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}
