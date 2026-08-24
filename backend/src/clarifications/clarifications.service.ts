import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateClarificationDto } from "./dto/create-clarification.dto";

@Injectable()
export class ClarificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCase(actor: Actor, casePublicId: string) {
    const rows = await this.prisma.clarification.findMany({
      where: {
        tenantId: actor.tenantId,
        case: {
          publicId: casePublicId,
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
        },
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
        tenantId: actor.tenantId,
        publicId: casePublicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: { id: true, status: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    const check = input.checkId
      ? await this.prisma.caseCheck.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.checkId,
            caseId: verificationCase.id,
          },
          select: { id: true },
        })
      : null;
    if (input.checkId && !check)
      throw new NotFoundException("Check not found in this case");

    const portalToken = randomBytes(32).toString("base64url");
    const tokenExpiresAt = new Date(Date.now() + 7 * 86_400_000);
    const clarification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clarification.create({
        data: {
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          checkId: check?.id,
          subject: input.subject.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
          responseTokenHash: this.digest(portalToken),
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
      if (verificationCase.status === "IN_PROGRESS") {
        await tx.verificationCase.update({
          where: { id: verificationCase.id },
          data: { status: "CLARIFICATION_PENDING", version: { increment: 1 } },
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: verificationCase.id,
            fromStatus: "IN_PROGRESS",
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
    const clarification = await this.authorizePublic(publicId, token);
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
    const clarification = await this.authorizePublic(publicId, token);
    const respondedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.clarificationMessage.create({
        data: {
          clarificationId: clarification.id,
          senderType: "CANDIDATE",
          body: body.trim(),
        },
      });
      await tx.clarification.update({
        where: { id: clarification.id },
        data: {
          status: "RESPONDED",
          responseTokenHash: null,
          responseTokenExpiresAt: null,
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
      const recipients = clarification.case.assignedOpsUserId
        ? [{ id: clarification.case.assignedOpsUserId }]
        : await tx.user.findMany({
            where: {
              tenantId: clarification.tenantId,
              status: "ACTIVE",
              userRoles: { some: { role: { code: "OPS_MANAGER" } } },
            },
            select: { id: true },
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
        case: {
          publicId: casePublicId,
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
        },
      },
      select: {
        id: true,
        status: true,
        subject: true,
        case: { select: { id: true, status: true } },
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
        const resumed = await tx.verificationCase.updateMany({
          where: { id: clarification.case.id, status: "CLARIFICATION_PENDING" },
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

  private async authorizePublic(publicId: string, token: string) {
    const clarification = await this.prisma.clarification.findUnique({
      where: { publicId },
      include: {
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            assignedOpsUserId: true,
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (
      !clarification.responseTokenHash ||
      !clarification.responseTokenExpiresAt ||
      clarification.responseTokenExpiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        "Clarification link is invalid or expired",
      );
    }
    const expected = Buffer.from(clarification.responseTokenHash);
    const actual = Buffer.from(this.digest(token));
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new UnauthorizedException(
        "Clarification link is invalid or expired",
      );
    }
    return clarification;
  }

  private digest(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
