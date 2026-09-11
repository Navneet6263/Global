import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";
import type { CompleteFollowUpDto } from "./dto/complete-follow-up.dto";
import { sequenceAfterCompletion } from "./crm-sequence.policy";

@Injectable()
export class CrmFollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  async complete(actor: Actor, publicId: string, input: CompleteFollowUpDto) {
    const opportunity = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        id: true,
        stage: true,
        version: true,
        nextFollowUpAt: true,
        followUpSequenceStartedAt: true,
        followUpSequenceStep: true,
      },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    if (["WON", "LOST"].includes(opportunity.stage)) {
      throw new BadRequestException(
        "A closed opportunity has no pending follow-up",
      );
    }
    if (!opportunity.nextFollowUpAt) {
      throw new BadRequestException(
        "This opportunity has no pending follow-up",
      );
    }
    if (opportunity.version !== input.version) {
      throw new ConflictException("Opportunity changed; refresh and try again");
    }

    return this.prisma.$transaction(async (tx) => {
      const completedAt = new Date();
      const sequence = sequenceAfterCompletion(
        opportunity.followUpSequenceStartedAt,
        opportunity.followUpSequenceStep,
      );
      const updated = await tx.salesOpportunity.updateMany({
        where: { id: opportunity.id, version: input.version },
        data: { ...sequence, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Opportunity was updated concurrently");
      }

      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: "FOLLOW_UP",
          summary: input.notes?.trim() || "Follow-up completed",
          occurredAt: completedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.follow-up.completed",
          resourceType: "sales-opportunity",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            nextFollowUpAt: opportunity.nextFollowUpAt,
            version: opportunity.version,
          }),
          afterJson: JSON.stringify({
            ...sequence,
            version: opportunity.version + 1,
          }),
        },
      });

      return {
        opportunityId: publicId,
        completedAt,
        version: opportunity.version + 1,
      };
    });
  }
}
