import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import { clientScope } from "./crm-opportunity.shared";
import type { CreateSalesActivityDto } from "./dto/create-sales-activity.dto";
import type { ListSalesActivitiesDto } from "./dto/list-sales-activities.dto";

@Injectable()
export class CrmActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: ListSalesActivitiesDto) {
    const search = query.search?.trim();
    const where: Prisma.SalesActivityWhereInput = {
      tenantId: actor.tenantId,
      opportunity: {
        ...clientScope(actor),
        ...(query.owner ? { owner: { publicId: query.owner } } : {}),
      },
      ...activityTypeWhere(query.type),
      ...(search
        ? {
            OR: [
              { summary: { contains: search } },
              { opportunity: { companyName: { contains: search } } },
              { opportunity: { contactName: { contains: search } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.salesActivity.findMany({
        where,
        select: {
          publicId: true,
          type: true,
          summary: true,
          occurredAt: true,
          actor: { select: { displayName: true } },
          opportunity: {
            select: { publicId: true, companyName: true, contactName: true },
          },
        },
        orderBy: [{ occurredAt: "desc" }, { publicId: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.salesActivity.count({ where }),
    ]);
    return {
      items: rows.map(({ publicId: id, opportunity, ...activity }) => ({
        id,
        ...activity,
        opportunity: {
          id: opportunity.publicId,
          companyName: opportunity.companyName,
          contactName: opportunity.contactName,
        },
      })),
      total,
      page: query.page,
      pageSize: query.limit,
    };
  }

  async add(actor: Actor, publicId: string, input: CreateSalesActivityDto) {
    const opportunity = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: { id: true, stage: true },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
    if (["WON", "LOST"].includes(opportunity.stage) && input.nextFollowUpAt) {
      throw new BadRequestException(
        "A closed opportunity cannot receive a new follow-up date",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          actorUserId: actor.userId,
          type: input.type,
          summary: input.summary.trim(),
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
        },
        select: {
          publicId: true,
          type: true,
          summary: true,
          occurredAt: true,
          actor: { select: { displayName: true } },
        },
      });
      if (input.nextFollowUpAt) {
        await tx.salesOpportunity.update({
          where: { id: opportunity.id },
          data: {
            nextFollowUpAt: new Date(input.nextFollowUpAt),
            version: { increment: 1 },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "crm.activity.created",
          resourceType: "sales-opportunity",
          resourcePublicId: publicId,
          afterJson: JSON.stringify({
            type: input.type,
            nextFollowUpAt: input.nextFollowUpAt ?? null,
          }),
        },
      });
      const { publicId: id, ...activity } = created;
      return { id, ...activity };
    });
  }
}

function activityTypeWhere(
  type: string | undefined,
): Prisma.SalesActivityWhereInput {
  if (type === "STAGE_CHANGE") return { type: "STAGE_CHANGED" };
  if (type === "NOTE")
    return { type: { in: ["NOTE", "UPDATED", "ONBOARDING_HANDOFF"] } };
  if (type === "WON" || type === "LOST") {
    return { type: "STAGE_CHANGED", summary: { contains: `to ${type}` } };
  }
  return type ? { type } : {};
}
