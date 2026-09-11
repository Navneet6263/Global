import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import { PrismaService } from "../database/prisma.service";
import { QaReadinessService } from "../verification/qa-readiness.service";
import { requestClarificationReverification } from "./clarification-reverification";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import type { CreateClarificationDto } from "./dto/create-clarification.dto";
import {
  ClarificationTokenService,
  digestClarificationToken,
} from "./clarification-token.service";

@Injectable()
export class ClarificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: ClarificationTokenService,
    private readonly qaReadiness: QaReadinessService,
  ) {}

  async listForCase(actor: Actor, casePublicId: string) {
    const rows = await this.prisma.clarification.findMany({
      where: {
        tenantId: actor.tenantId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: {
        publicId: true,
        status: true,
        subject: true,
        dueAt: true,
        resolvedAt: true,
        createdAt: true,
        messages: {
          select: { senderType: true, body: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: rows.map(({ publicId, ...row }) => ({ id: publicId, ...row })),
    };
  }

  async create(
    actor: Actor,
    casePublicId: string,
    input: CreateClarificationDto,
  ) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: {
        ...caseAccessScope(actor),
        publicId: casePublicId,
      },
      select: { id: true, status: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    if (
      [
        "MANAGER_REVIEW",
        "REPORT_PENDING",
        "PAYMENT_PENDING",
        "COMPLETED",
        "CLOSED",
        "CANCELLED",
      ].includes(verificationCase.status)
    ) {
      throw new ConflictException(
        "A completed or cancelled case cannot receive a clarification",
      );
    }
    const check = input.checkId
      ? await this.prisma.caseCheck.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.checkId,
            caseId: verificationCase.id,
          },
          select: { id: true, reviewCycle: true },
        })
      : null;
    if (input.checkId && !check)
      throw new NotFoundException("Check not found in this case");

    const portalToken = randomBytes(32).toString("base64url");
    const tokenExpiresAt = new Date(Date.now() + 7 * 86_400_000);
    const clarification = await this.prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, verificationCase.id, true);
      const currentCheck = check
        ? await tx.caseCheck.findUniqueOrThrow({
            where: { id: check.id },
            select: { reviewCycle: true },
          })
        : null;
      const created = await tx.clarification.create({
        data: {
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          checkId: check?.id,
          checkCycle: currentCheck?.reviewCycle,
          subject: input.subject.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          responseTokenHash: digestClarificationToken(portalToken),
          responseTokenExpiresAt: tokenExpiresAt,
          messages: {
            create: {
              senderUserId: actor.userId,
              senderType: "TEAM",
              body: input.message.trim(),
            },
          },
        },
        select: {
          publicId: true,
          status: true,
          subject: true,
          dueAt: true,
          createdAt: true,
        },
      });
      if (["IN_PROGRESS", "QA_REVIEW"].includes(verificationCase.status)) {
        await tx.verificationCase.update({
          where: { id: verificationCase.id },
          data: {
            status: "CLARIFICATION_PENDING",
            qaReviewerId: null,
            qaClaimedAt: null,
            version: { increment: 1 },
          },
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: verificationCase.id,
            fromStatus: verificationCase.status,
            toStatus: "CLARIFICATION_PENDING",
            changedById: actor.userId,
            reason: input.subject,
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "clarification.created",
          resourceType: "clarification",
          resourcePublicId: created.publicId,
        },
      });
      return created;
    });
    return {
      id: clarification.publicId,
      status: clarification.status,
      subject: clarification.subject,
      dueAt: clarification.dueAt,
      createdAt: clarification.createdAt,
      portalToken,
      tokenExpiresAt,
    };
  }

  async getPublic(publicId: string, token: string) {
    const clarification = await this.tokens.authorize(publicId, token);
    return {
      id: clarification.publicId,
      status: clarification.status,
      subject: clarification.subject,
      dueAt: clarification.dueAt,
      caseNumber: clarification.case.caseNumber,
      messages: clarification.messages.map(
        ({ senderType, body, createdAt }) => ({
          sender: senderType,
          body,
          createdAt,
        }),
      ),
    };
  }

  async respond(publicId: string, token: string, body: string) {
    const clarification = await this.tokens.authorize(publicId, token);
    const respondedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clarification.updateMany({
        where: {
          id: clarification.id,
          status: "OPEN",
          responseTokenHash: clarification.responseTokenHash,
        },
        data: {
          status: "RESPONDED",
          responseTokenHash: null,
          responseTokenExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Clarification changed; refresh before responding again",
        );
      }
      await tx.clarificationMessage.create({
        data: {
          clarificationId: clarification.id,
          senderType: "CANDIDATE",
          body: body.trim(),
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: clarification.tenantId,
          topic: "clarification.responded",
          aggregateType: "clarification",
          aggregateId: publicId,
          payloadJson: JSON.stringify({
            clarificationId: publicId,
            respondedAt,
          }),
        },
      });
      const recipients = await activeOperationsRecipients(tx, {
        tenantId: clarification.tenantId,
        branchId: clarification.case.branchId,
        clientId: clarification.case.clientId,
        assignedUserId: clarification.case.assignedOpsUserId,
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            tenantId: clarification.tenantId,
            userId: recipient.id,
            type: "CLARIFICATION_RESPONDED",
            title: "Candidate response received",
            body: `${clarification.case.caseNumber}: ${clarification.subject}`,
            href: `/cases/${clarification.case.publicId}`,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: clarification.tenantId,
          action: "clarification.candidate-responded",
          resourceType: "clarification",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({ status: "RESPONDED", respondedAt }),
        },
      });
    });
    return { received: true, respondedAt };
  }

  async resolve(
    actor: Actor,
    casePublicId: string,
    clarificationPublicId: string,
    note?: string,
  ) {
    const clarification = await this.prisma.clarification.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clarificationPublicId,
        case: { ...caseAccessScope(actor), publicId: casePublicId },
      },
      select: {
        id: true,
        status: true,
        subject: true,
        checkId: true,
        reverificationRequired: true,
        case: {
          select: {
            id: true,
            publicId: true,
            status: true,
            branchId: true,
            clientId: true,
          },
        },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (clarification.status === "RESOLVED") {
      return {
        id: clarificationPublicId,
        status: "RESOLVED",
        caseStatus: clarification.case.status,
      };
    }
    if (clarification.status !== "RESPONDED") {
      throw new BadRequestException(
        "A candidate response must be reviewed before resolution",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, clarification.case.id, true);
      const updated = await tx.clarification.updateMany({
        where: { id: clarification.id, status: "RESPONDED" },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          responseTokenHash: null,
          responseTokenExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Clarification changed; refresh and try again",
        );
      }
      if (note?.trim()) {
        await tx.clarificationMessage.create({
          data: {
            clarificationId: clarification.id,
            senderUserId: actor.userId,
            senderType: "TEAM",
            body: note.trim(),
          },
        });
      }

      if (clarification.reverificationRequired) {
        await requestClarificationReverification(tx, actor, {
          caseId: clarification.case.id,
          checkId: clarification.checkId,
          subject: clarification.subject,
        });
      }
      const remaining = await tx.clarification.count({
        where: {
          caseId: clarification.case.id,
          status: { in: ["OPEN", "RESPONDED"] },
        },
      });
      let caseStatus = clarification.case.status;
      if (
        remaining === 0 &&
        clarification.case.status === "CLARIFICATION_PENDING"
      ) {
        const qaReady = await this.qaReadiness.promoteIfReady(tx, {
          tenantId: actor.tenantId,
          caseId: clarification.case.id,
          casePublicId: clarification.case.publicId,
          branchId: clarification.case.branchId,
          clientId: clarification.case.clientId,
          changedById: actor.userId,
          fromStatus: "CLARIFICATION_PENDING",
          reason: "All clarifications resolved after check completion",
        });
        if (qaReady) {
          caseStatus = "QA_REVIEW";
        } else {
          const resumed = await tx.verificationCase.updateMany({
            where: {
              id: clarification.case.id,
              status: "CLARIFICATION_PENDING",
            },
            data: { status: "IN_PROGRESS", version: { increment: 1 } },
          });
          if (resumed.count === 1) {
            caseStatus = "IN_PROGRESS";
            await tx.caseStatusHistory.create({
              data: {
                caseId: clarification.case.id,
                fromStatus: "CLARIFICATION_PENDING",
                toStatus: "IN_PROGRESS",
                changedById: actor.userId,
                reason: "All candidate clarifications reviewed and resolved",
              },
            });
          }
        }
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "clarification.resolved",
          resourceType: "clarification",
          resourcePublicId: clarificationPublicId,
          beforeJson: JSON.stringify({ status: clarification.status }),
          afterJson: JSON.stringify({ status: "RESOLVED", caseStatus }),
        },
      });
      return { id: clarificationPublicId, status: "RESOLVED", caseStatus };
    });
  }
}
