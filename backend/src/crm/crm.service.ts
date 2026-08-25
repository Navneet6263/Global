import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CreateOpportunityDto } from "./dto/create-opportunity.dto";
import type { ListOpportunitiesDto } from "./dto/list-opportunities.dto";
import type { UpdateOpportunityDto } from "./dto/update-opportunity.dto";

const opportunitySelect = {
  publicId: true,
  companyName: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  stage: true,
  source: true,
  estimatedValue: true,
  probability: true,
  expectedCloseDate: true,
  notes: true,
  closedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { publicId: true, displayName: true, email: true } },
  client: { select: { publicId: true, displayName: true } },
} as const;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: Actor) {
    const now = new Date();
    const months = this.monthWindows(now);
    const trendStart = months[0]!.start;
    const [stages, total, weighted, activities, trendRows] = await Promise.all([
      this.prisma.salesOpportunity.groupBy({
        by: ["stage"],
        where: { tenantId: actor.tenantId },
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.salesOpportunity.aggregate({
        where: { tenantId: actor.tenantId, stage: { notIn: ["WON", "LOST"] } },
        _sum: { estimatedValue: true },
        _count: { _all: true },
      }),
      this.prisma.salesOpportunity.findMany({
        where: { tenantId: actor.tenantId, stage: { notIn: ["WON", "LOST"] } },
        select: { estimatedValue: true, probability: true, ownerId: true },
      }),
      this.prisma.salesActivity.findMany({
        where: { tenantId: actor.tenantId },
        select: {
          publicId: true,
          type: true,
          summary: true,
          occurredAt: true,
          actor: { select: { displayName: true } },
          opportunity: { select: { publicId: true, companyName: true } },
        },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
      this.prisma.salesOpportunity.findMany({
        where: {
          tenantId: actor.tenantId,
          OR: [
            { createdAt: { gte: trendStart } },
            { closedAt: { gte: trendStart } },
          ],
        },
        select: {
          createdAt: true,
          closedAt: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          ownerId: true,
        },
        take: 5000,
      }),
    ]);
    const weightedValue = weighted.reduce(
      (sum, item) =>
        sum + Number(item.estimatedValue) * (item.probability / 100),
      0,
    );
    return {
      summary: {
        openCount: total._count._all,
        openValue: Number(total._sum.estimatedValue ?? 0),
        weightedValue: Math.round(weightedValue * 100) / 100,
        activeOwners: new Set(
          weighted.flatMap((item) =>
            item.ownerId === null ? [] : [item.ownerId.toString()],
          ),
        ).size,
        wonValue: Number(
          stages.find((item) => item.stage === "WON")?._sum.estimatedValue ?? 0,
        ),
      },
      stages: stages.map((item) => ({
        stage: item.stage,
        count: item._count._all,
        value: Number(item._sum.estimatedValue ?? 0),
      })),
      activities: activities.map(({ publicId, ...activity }) => ({
        id: publicId,
        ...activity,
      })),
      trend: months.map(({ start, end, label }) => {
        const created = trendRows.filter(
          (item) => item.createdAt >= start && item.createdAt < end,
        );
        const won = trendRows.filter(
          (item) =>
            item.stage === "WON" &&
            item.closedAt &&
            item.closedAt >= start &&
            item.closedAt < end,
        );
        return {
          month: label,
          pipelineValue: created.reduce(
            (sum, item) => sum + Number(item.estimatedValue),
            0,
          ),
          weightedValue: created.reduce(
            (sum, item) =>
              sum + Number(item.estimatedValue) * (item.probability / 100),
            0,
          ),
          wonValue: won.reduce(
            (sum, item) => sum + Number(item.estimatedValue),
            0,
          ),
          activeOwners: new Set(
            created.flatMap((item) =>
              item.ownerId === null ? [] : [item.ownerId.toString()],
            ),
          ).size,
        };
      }),
      generatedAt: now,
    };
  }

  private monthWindows(now: Date) {
    return Array.from({ length: 6 }, (_, index) => {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1),
      );
      return {
        start,
        end: new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
        ),
        label: start.toLocaleString("en", {
          month: "short",
          timeZone: "UTC",
        }),
      };
    });
  }

  async list(actor: Actor, query: ListOpportunitiesDto) {
    const search = query.search?.trim();
    const rows = await this.prisma.salesOpportunity.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.stage ? { stage: query.stage } : {}),
        ...(search
          ? {
              OR: [
                { companyName: { contains: search } },
                { contactName: { contains: search } },
                { contactEmail: { contains: search } },
              ],
            }
          : {}),
      },
      select: opportunitySelect,
      orderBy: [{ updatedAt: "desc" }, { publicId: "asc" }],
      take: 250,
    });
    return {
      items: rows.map(({ publicId, ...item }) => ({ id: publicId, ...item })),
    };
  }

  async create(actor: Actor, input: CreateOpportunityDto) {
    const [client, owner] = await Promise.all([
      input.clientId
        ? this.prisma.client.findFirst({
            where: { tenantId: actor.tenantId, publicId: input.clientId },
            select: { id: true },
          })
        : null,
      input.ownerId
        ? this.prisma.user.findFirst({
            where: {
              tenantId: actor.tenantId,
              publicId: input.ownerId,
              status: "ACTIVE",
            },
            select: { id: true },
          })
        : null,
    ]);
    if (input.clientId && !client)
      throw new NotFoundException("Client not found");
    if (input.ownerId && !owner) throw new NotFoundException("Owner not found");
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.salesOpportunity.create({
        data: {
          tenantId: actor.tenantId,
          clientId: client?.id,
          ownerId: owner?.id ?? actor.userId,
          companyName: input.companyName.trim(),
          contactName: input.contactName.trim(),
          contactEmail: input.contactEmail?.trim().toLowerCase(),
          contactPhone: input.contactPhone?.trim(),
          stage: input.stage,
          source: input.source?.trim().toUpperCase(),
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate
            ? new Date(input.expectedCloseDate)
            : undefined,
          notes: input.notes?.trim(),
          closedAt: ["WON", "LOST"].includes(input.stage)
            ? new Date()
            : undefined,
        },
        select: opportunitySelect,
      });
      await tx.salesActivity.create({
        data: {
          tenantId: actor.tenantId,
          opportunityId: (
            await tx.salesOpportunity.findUniqueOrThrow({
              where: { publicId: created.publicId },
              select: { id: true },
            })
          ).id,
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
      where: { tenantId: actor.tenantId, publicId },
      select: { id: true, stage: true, version: true },
    });
    if (!existing) throw new NotFoundException("Opportunity not found");
    if (existing.version !== input.version)
      throw new ConflictException("Opportunity changed; refresh and try again");
    const owner = input.ownerId
      ? await this.prisma.user.findFirst({
          where: {
            tenantId: actor.tenantId,
            publicId: input.ownerId,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : null;
    if (input.ownerId && !owner) throw new NotFoundException("Owner not found");
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.salesOpportunity.updateMany({
        where: { id: existing.id, version: input.version },
        data: {
          stage: input.stage,
          ownerId: owner?.id,
          estimatedValue: input.estimatedValue,
          probability: input.probability,
          expectedCloseDate: input.expectedCloseDate
            ? new Date(input.expectedCloseDate)
            : undefined,
          notes: input.notes?.trim(),
          closedAt:
            input.stage && ["WON", "LOST"].includes(input.stage)
              ? new Date()
              : input.stage
                ? null
                : undefined,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Opportunity was updated concurrently");
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
            input.activitySummary?.trim() ??
            (input.stage
              ? `Stage changed from ${existing.stage} to ${input.stage}`
              : "Opportunity updated"),
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
}
