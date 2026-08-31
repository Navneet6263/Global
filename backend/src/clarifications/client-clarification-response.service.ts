import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class ClientClarificationResponseService {
  constructor(private readonly prisma: PrismaService) {}

  async respond(
    actor: Actor,
    casePublicId: string,
    clarificationPublicId: string,
    body: string,
  ) {
    if (!actor.clientId) {
      throw new ForbiddenException(
        "Only a client-scoped account can submit a client response",
      );
    }
    const clarification = await this.prisma.clarification.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: clarificationPublicId,
        case: { publicId: casePublicId, clientId: actor.clientId },
      },
      select: {
        id: true,
        status: true,
        subject: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            assignedOpsUserId: true,
            branchId: true,
            clientId: true,
          },
        },
      },
    });
    if (!clarification) throw new NotFoundException("Clarification not found");
    if (clarification.status !== "OPEN") {
      throw new ConflictException(
        "Only an open clarification can receive a new client response",
      );
    }

    const respondedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.clarification.updateMany({
        where: { id: clarification.id, status: "OPEN" },
        data: {
          status: "RESPONDED",
          responseTokenHash: null,
          responseTokenExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Clarification changed; refresh and try again",
        );
      }
      await tx.clarificationMessage.create({
        data: {
          clarificationId: clarification.id,
          senderUserId: actor.userId,
          senderType: "CLIENT",
          body: body.trim(),
        },
      });
      const recipients = await activeOperationsRecipients(tx, {
        tenantId: actor.tenantId,
        branchId: clarification.case.branchId,
        clientId: clarification.case.clientId,
        assignedUserId: clarification.case.assignedOpsUserId,
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            tenantId: actor.tenantId,
            userId: recipient.id,
            type: "CLARIFICATION_RESPONDED",
            title: "Client response received",
            body: `${clarification.case.caseNumber}: ${clarification.subject}`,
            href: `/cases/${clarification.case.publicId}`,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "clarification.client-responded",
          resourceType: "clarification",
          resourcePublicId: clarificationPublicId,
          afterJson: JSON.stringify({ status: "RESPONDED", respondedAt }),
        },
      });
    });
    return { received: true, respondedAt };
  }
}
