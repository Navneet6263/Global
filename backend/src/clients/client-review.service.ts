import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { issueCandidateLink } from "../candidate-portal/candidate-link";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { PrismaService } from "../database/prisma.service";
import { applyAutoAssignment } from "../workflow/intake-rules";

/**
 * Route A (BGV process, intake routing): the company admin reviews what its candidate
 * submitted before Sapling starts. Approve sends it on to the RM (and the auto Data
 * Entry rule); Return sends the candidate a fresh link with the reason. Audited.
 */
@Injectable()
export class ClientReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly pii: SubjectPiiService,
  ) {}

  async list(actor: Actor) {
    const clientId = this.clientOf(actor);
    const rows = await this.prisma.verificationCase.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId,
        intakeStage: { in: ["CLIENT_REVIEW", "CLIENT_RETURNED"] },
      },
      orderBy: { updatedAt: "asc" },
      take: 100,
      select: {
        publicId: true,
        caseNumber: true,
        version: true,
        intakeStage: true,
        updatedAt: true,
        subject: { select: { fullName: true } },
        documents: {
          select: {
            publicId: true,
            type: true,
            status: true,
            currentVersion: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return {
      items: rows.map((row) => ({
        id: row.publicId,
        caseNumber: row.caseNumber,
        version: row.version,
        candidateName: row.subject.fullName,
        state:
          row.intakeStage === "CLIENT_REVIEW" ? "TO_REVIEW" : "WITH_CANDIDATE",
        since: row.updatedAt,
        documents: row.documents.map(({ publicId, ...document }) => ({
          id: publicId,
          ...document,
        })),
      })),
    };
  }

  async approve(actor: Actor, casePublicId: string, version: number) {
    const item = await this.find(actor, casePublicId, version);
    const autoAssigned = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: item.id, version, intakeStage: "CLIENT_REVIEW" },
        data: { intakeStage: "INTAKE", version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case changed; refresh and try again");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.client-review-approved",
          resourceType: "case",
          resourcePublicId: casePublicId,
          afterJson: JSON.stringify({
            caseNumber: item.caseNumber,
            intakeStage: "INTAKE",
          }),
        },
      });
      const auto = await applyAutoAssignment(tx, item.id);
      if (!auto && item.assignedOpsUserId)
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: item.assignedOpsUserId,
            type: "CLIENT_REVIEW_APPROVED",
            title: "Client approved the submission",
            body: `${item.caseNumber}: assign Data Entry to start.`,
            href: `/spoc-rm/work?caseId=${casePublicId}`,
          },
        });
      return auto;
    });
    return { id: casePublicId, approved: true, autoAssigned };
  }

  async returnToCandidate(
    actor: Actor,
    casePublicId: string,
    version: number,
    reason: string,
  ) {
    const item = await this.find(actor, casePublicId, version);
    const text = reason.trim();
    const link = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: { id: item.id, version, intakeStage: "CLIENT_REVIEW" },
        data: { intakeStage: "CLIENT_RETURNED", version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case changed; refresh and try again");
      const issued = await issueCandidateLink(
        tx,
        {
          secretBox: this.secretBox,
          pii: this.pii,
          webOrigin: this.config.getOrThrow<string>("WEB_ORIGIN"),
        },
        {
          tenantId: actor.tenantId,
          caseId: item.id,
          casePublicId,
          actorUserId: actor.userId,
          subject: item.subject,
          sendNotification: true,
          reason: `Your employer asked for a change: ${text}`.slice(0, 900),
        },
      );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.client-review-returned",
          resourceType: "case",
          resourcePublicId: casePublicId,
          afterJson: JSON.stringify({
            caseNumber: item.caseNumber,
            intakeStage: "CLIENT_RETURNED",
            reason: text,
            candidateNotified: issued.delivery.queued,
          }),
        },
      });
      return issued;
    });
    return {
      id: casePublicId,
      returned: true,
      candidateNotified: link.delivery.queued,
    };
  }

  private clientOf(actor: Actor) {
    if (!actor.roles.includes("CLIENT_ADMIN") || !actor.clientId)
      throw new ForbiddenException(
        "Only the company admin reviews submissions",
      );
    return actor.clientId;
  }

  private async find(actor: Actor, publicId: string, version: number) {
    const clientId = this.clientOf(actor);
    const item = await this.prisma.verificationCase.findFirst({
      where: { tenantId: actor.tenantId, clientId, publicId },
      select: {
        id: true,
        caseNumber: true,
        version: true,
        intakeStage: true,
        assignedOpsUserId: true,
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
    if (!item) throw new NotFoundException("Case not found");
    if (item.intakeStage !== "CLIENT_REVIEW")
      throw new ConflictException(
        "This submission is not waiting for your review",
      );
    if (item.version !== version)
      throw new ConflictException("Case changed; refresh and try again");
    return item;
  }
}
