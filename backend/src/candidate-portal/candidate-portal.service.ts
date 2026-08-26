import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { PrismaService } from "../database/prisma.service";
import { DocumentsService } from "../documents/documents.service";

@Injectable()
export class CandidatePortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  async issue(actor: Actor, casePublicId: string) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: casePublicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: { id: true, publicId: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 86_400_000);
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
      return created;
    });
    return { id: access.publicId, token, expiresAt };
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
      case: {
        caseNumber: access.case.caseNumber,
        status: access.case.status,
        candidateName: access.case.subject.fullName,
        clientName: access.case.client.displayName,
        dueAt: access.case.dueAt,
        checks: access.case.checks.map((check) => ({
          type: check.type,
          status: check.status,
        })),
        documents: access.case.documents.map((document) => ({
          type: document.type,
          status: document.status,
          currentVersion: document.currentVersion,
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
  ) {
    const access = await this.authorize(publicId, token);
    return this.documents.uploadForCandidate(
      {
        tenantId: access.tenantId,
        tenantPublicId: access.tenant.publicId,
        caseId: access.caseId,
        casePublicId: access.case.publicId,
      },
      type.trim().toUpperCase(),
      file,
    );
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
      const recipients = access.case.assignedOpsUserId
        ? [{ id: access.case.assignedOpsUserId }]
        : await tx.user.findMany({
            where: {
              tenantId: access.tenantId,
              status: "ACTIVE",
              userRoles: { some: { role: { code: "OPS_MANAGER" } } },
            },
            select: { id: true },
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
              select: { type: true, status: true, currentVersion: true },
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
