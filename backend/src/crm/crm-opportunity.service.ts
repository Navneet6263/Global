import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import {
  clientScope,
  opportunitySelect,
  optionalText,
} from "./crm-opportunity.shared";
import type { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import type { UpdateOpportunityDto } from "./dto/update-opportunity.dto";
import { CrmSettingsService } from "./crm-settings.service";

@Injectable()
export class CrmOpportunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: CrmSettingsService,
  ) {}

  async create(actor: Actor, input: CreateOpportunityDto) {
    if (["WON", "LOST"].includes(input.stage)) {
      throw new BadRequestException(
        "A new opportunity must begin in an open pipeline stage",
      );
    }
    const settings = await this.settings.resolve(actor);
    const source = input.source?.trim().toUpperCase();
    this.assertLeadSource(source, settings.leadSources);
    const [client, owner] = await Promise.all([
      input.clientId || actor.clientId
        ? this.prisma.client.findFirst({
            where: {
              tenantId: actor.tenantId,
              ...(input.clientId ? { publicId: input.clientId } : {}),
              ...(actor.clientId ? { id: actor.clientId } : {}),
            },
            select: { id: true },
          })
        : null,
      input.ownerId ? this.findOwner(actor, input.ownerId) : null,
    ]);
    if ((input.clientId || actor.clientId) && !client) {
      throw new NotFoundException("Client not found");
    }
    if (input.ownerId && !owner) throw new NotFoundException("Owner not found");

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.salesOpportunity.create({
        data: {
          tenantId: actor.tenantId,
          clientId: client?.id ?? actor.clientId,
          ownerId: owner?.id,
          companyName: input.companyName.trim(),
          city: optionalText(input.city),
          industry: optionalText(input.industry),
          contactName: input.contactName.trim(),
          contactTitle: optionalText(input.contactTitle),
          contactEmail: input.contactEmail?.trim().toLowerCase(),
          contactPhone: input.contactPhone?.trim(),
          stage: input.stage,
          source,
          estimatedValue: input.estimatedValue,
          probability:
            input.probability ??
            settings.stageProbabilities[
              input.stage as keyof typeof settings.stageProbabilities
            ],
          expectedCloseDate: input.expectedCloseDate
            ? new Date(input.expectedCloseDate)
            : undefined,
          nextFollowUpAt: input.nextFollowUpAt
            ? new Date(input.nextFollowUpAt)
            : undefined,
          notes: input.notes?.trim(),
          closedAt: ["WON", "LOST"].includes(input.stage)
            ? new Date()
            : undefined,
        },
        select: opportunitySelect,
      });
      const opportunity = await tx.salesOpportunity.findUniqueOrThrow({
        where: { publicId: created.publicId },
        select: { id: true },
      });
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: "CREATED",
          summary: "Opportunity created",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.opportunity.created",
          resourceType: "sales-opportunity",
          resourcePublicId: created.publicId,
        },
      });
      const { publicId, ...item } = created;
      return { id: publicId, ...item };
    });
  }

  async update(actor: Actor, publicId: string, input: UpdateOpportunityDto) {
    const existing = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: { id: true, stage: true, source: true, version: true },
    });
    if (!existing) throw new NotFoundException("Opportunity not found");
    if (existing.version !== input.version) {
      throw new ConflictException("Opportunity changed; refresh and try again");
    }
    if (input.stage === "LOST" && !input.lostReason?.trim()) {
      throw new BadRequestException(
        "A lost reason is required before closing an opportunity",
      );
    }
    const settings = await this.settings.resolve(actor);
    const source = input.source?.trim().toUpperCase();
    if (source !== undefined && source !== existing.source) {
      this.assertLeadSource(source, settings.leadSources);
    }
    const owner = input.ownerId
      ? await this.findOwner(actor, input.ownerId)
      : null;
    if (input.ownerId && !owner) throw new NotFoundException("Owner not found");

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesOpportunity.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          companyName: input.companyName?.trim(),
          city: optionalText(input.city),
          industry: optionalText(input.industry),
          contactName: input.contactName?.trim(),
          contactTitle: optionalText(input.contactTitle),
          contactEmail: input.contactEmail?.trim().toLowerCase(),
          contactPhone: input.contactPhone?.trim(),
          source,
          stage: input.stage,
          ...(input.ownerId !== undefined
            ? { ownerId: owner?.id ?? null }
            : {}),
          estimatedValue: input.estimatedValue,
          probability:
            input.probability ??
            (input.stage
              ? settings.stageProbabilities[
                  input.stage as keyof typeof settings.stageProbabilities
                ]
              : undefined),
          expectedCloseDate: input.expectedCloseDate
            ? new Date(input.expectedCloseDate)
            : undefined,
          nextFollowUpAt:
            input.stage && ["WON", "LOST"].includes(input.stage)
              ? null
              : input.nextFollowUpAt
                ? new Date(input.nextFollowUpAt)
                : undefined,
          ...((input.stage && ["WON", "LOST"].includes(input.stage)) ||
          input.nextFollowUpAt
            ? { followUpSequenceStartedAt: null, followUpSequenceStep: null }
            : {}),
          notes: optionalText(input.notes),
          lostReason:
            input.stage === "LOST"
              ? input.lostReason!.trim()
              : input.stage
                ? null
                : input.lostReason?.trim(),
          closedAt:
            input.stage && ["WON", "LOST"].includes(input.stage)
              ? new Date()
              : input.stage
                ? null
                : undefined,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Opportunity was updated concurrently");
      }
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: existing.id,
          actorUserId: actor.userId,
          type:
            input.stage && input.stage !== existing.stage
              ? "STAGE_CHANGED"
              : "UPDATED",
          summary:
            input.stage && input.stage !== existing.stage
              ? [
                  `Stage changed from ${existing.stage} to ${input.stage}`,
                  input.activitySummary?.trim(),
                ]
                  .filter(Boolean)
                  .join(" — ")
              : input.activitySummary?.trim() || "Opportunity updated",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.opportunity.updated",
          resourceType: "sales-opportunity",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            stage: existing.stage,
            version: existing.version,
          }),
          afterJson: JSON.stringify({
            stage: input.stage ?? existing.stage,
            version: existing.version + 1,
          }),
        },
      });
      const row = await tx.salesOpportunity.findUniqueOrThrow({
        where: { id: existing.id },
        select: opportunitySelect,
      });
      const { publicId: id, ...item } = row;
      return { id, ...item };
    });
  }

  private findOwner(actor: Actor, publicId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "SALES_MANAGER" } } },
      },
      select: { id: true },
    });
  }

  private assertLeadSource(
    source: string | undefined,
    allowed: readonly string[],
  ) {
    if (source && !allowed.includes(source)) {
      throw new BadRequestException(
        "Lead source is not enabled in this tenant's CRM settings",
      );
    }
  }
}
