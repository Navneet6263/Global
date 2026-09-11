import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";
import type { PrepareOnboardingDto } from "./dto/prepare-onboarding.dto";

@Injectable()
export class CrmHandoffService {
  constructor(private readonly prisma: PrismaService) {}

  async prepare(actor: Actor, publicId: string, input: PrepareOnboardingDto) {
    const opportunity = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        id: true,
        stage: true,
        version: true,
        onboardingHandoffAt: true,
        clientId: true,
        companyName: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        client: { select: { publicId: true } },
      },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    if (opportunity.stage !== "WON") {
      throw new BadRequestException(
        "Only a won opportunity can be handed to onboarding",
      );
    }
    if (opportunity.onboardingHandoffAt && opportunity.clientId) {
      return handoffResponse(
        publicId,
        opportunity.onboardingHandoffAt,
        opportunity.version,
        opportunity.client?.publicId,
      );
    }
    if (opportunity.version !== input.version) {
      throw new ConflictException("Opportunity changed; refresh and try again");
    }

    return this.prisma.$transaction(async (tx) => {
      const preparedAt = new Date();
      const updated = await tx.salesOpportunity.updateMany({
        where: {
          id: opportunity.id,
          version: input.version,
        },
        data: { onboardingHandoffAt: preparedAt, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Opportunity was updated concurrently");
      }
      let clientId = opportunity.client?.publicId;
      if (!opportunity.clientId) {
        const client = await tx.client.create({
          data: {
            tenantId: actor.tenantId,
            code: `CRM-${publicId.replaceAll("-", "").slice(0, 24).toUpperCase()}`,
            legalName: opportunity.companyName,
            displayName: opportunity.companyName.slice(0, 120),
            contactName: opportunity.contactName,
            contactEmail: opportunity.contactEmail,
            contactPhone: opportunity.contactPhone,
            status: "ONBOARDING",
          },
          select: { id: true, publicId: true },
        });
        clientId = client.publicId;
        await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: { clientId: client.id },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: "client.onboarding-created",
            resourceType: "client",
            resourcePublicId: client.publicId,
            afterJson: JSON.stringify({
              opportunityId: publicId,
              status: "ONBOARDING",
            }),
          },
        });
      }
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: "ONBOARDING_HANDOFF",
          summary:
            "Client workspace linked; complete commercial settings before activation",
          occurredAt: preparedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.onboarding-handoff.prepared",
          resourceType: "sales-opportunity",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            onboardingHandoffAt: null,
            version: input.version,
          }),
          afterJson: JSON.stringify({
            onboardingHandoffAt: preparedAt,
            version: input.version + 1,
            clientId,
          }),
        },
      });
      return handoffResponse(publicId, preparedAt, input.version + 1, clientId);
    });
  }
}

function handoffResponse(
  opportunityId: string,
  preparedAt: Date,
  version: number,
  clientId?: string,
) {
  return { opportunityId, preparedAt, version, clientId };
}
