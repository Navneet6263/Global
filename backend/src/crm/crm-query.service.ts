import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { ListOpportunitiesDto } from "./dto/list-opportunities.dto";
import { clientScope, opportunitySelect } from "./crm-opportunity.shared";

@Injectable()
export class CrmQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: ListOpportunitiesDto) {
    const search = query.search?.trim();
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const where: Prisma.SalesOpportunityWhereInput = {
      tenantId: actor.tenantId,
      ...clientScope(actor),
      AND: [savedViewWhere(actor, query.savedView, now)],
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.owner === "unassigned"
        ? { ownerId: null }
        : query.owner
          ? { owner: { publicId: query.owner } }
          : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.minValue !== undefined || query.maxValue !== undefined
        ? { estimatedValue: { gte: query.minValue, lte: query.maxValue } }
        : {}),
      ...(query.minProbability !== undefined ||
      query.maxProbability !== undefined
        ? {
            probability: {
              gte: query.minProbability,
              lte: query.maxProbability,
            },
          }
        : {}),
      ...(query.closeFrom || query.closeTo
        ? {
            expectedCloseDate: {
              gte: query.closeFrom ? new Date(query.closeFrom) : undefined,
              lte: query.closeTo ? new Date(query.closeTo) : undefined,
            },
          }
        : {}),
      ...followUpWhere(query.followUp, now, today, tomorrow),
      ...(search
        ? {
            OR: [
              { companyName: { contains: search } },
              { city: { contains: search } },
              { industry: { contains: search } },
              { contactName: { contains: search } },
              { contactTitle: { contains: search } },
              { contactEmail: { contains: search } },
              { contactPhone: { contains: search } },
            ],
          }
        : {}),
    };
    const orderBy = opportunityOrder(query.sort);
    const [rows, total] = await Promise.all([
      this.prisma.salesOpportunity.findMany({
        where,
        select: opportunitySelect,
        orderBy,
        take: query.limit + (query.cursor ? 1 : 0),
        ...(query.cursor
          ? { cursor: { publicId: query.cursor }, skip: 1 }
          : { skip: (query.page - 1) * query.limit }),
      }),
      this.prisma.salesOpportunity.count({ where }),
    ]);
    const hasMore = query.cursor
      ? rows.length > query.limit
      : query.page * query.limit < total;
    const page =
      query.cursor && rows.length > query.limit
        ? rows.slice(0, query.limit)
        : rows;
    return {
      items: page.map(({ publicId, ...item }) => ({ id: publicId, ...item })),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      total,
      page: query.page,
      pageSize: query.limit,
    };
  }

  async owners(actor: Actor) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const nextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const [owners, opportunities, recentActivities] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          tenantId: actor.tenantId,
          status: "ACTIVE",
          userRoles: { some: { role: { code: "SALES_MANAGER" } } },
        },
        select: {
          id: true,
          publicId: true,
          displayName: true,
          email: true,
          branch: { select: { name: true } },
        },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
      }),
      this.prisma.salesOpportunity.findMany({
        where: {
          tenantId: actor.tenantId,
          ...clientScope(actor),
          ownerId: { not: null },
        },
        select: {
          ownerId: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          nextFollowUpAt: true,
          expectedCloseDate: true,
        },
      }),
      this.prisma.salesActivity.findMany({
        where: {
          tenantId: actor.tenantId,
          occurredAt: { gte: weekAgo },
          opportunity: { ...clientScope(actor), ownerId: { not: null } },
        },
        select: { opportunity: { select: { ownerId: true } } },
      }),
    ]);
    return {
      items: owners.map(({ id: internalId, publicId: id, ...owner }) => {
        const rows = opportunities.filter((row) => row.ownerId === internalId);
        const open = rows.filter((row) => !["WON", "LOST"].includes(row.stage));
        const won = rows.filter((row) => row.stage === "WON");
        const closed = rows.filter((row) =>
          ["WON", "LOST"].includes(row.stage),
        );
        return {
          id,
          ...owner,
          activeOpportunities: open.length,
          pipelineValue: sumOpportunityValue(open),
          weightedForecast: sumOpportunityWeighted(open),
          wonRevenue: sumOpportunityValue(won),
          winRate: rate(won.length, closed.length),
          overdueFollowUps: open.filter(
            (row) => row.nextFollowUpAt !== null && row.nextFollowUpAt < now,
          ).length,
          activitiesThisWeek: recentActivities.filter(
            (row) => row.opportunity.ownerId === internalId,
          ).length,
          closingThisMonth: open.filter(
            (row) =>
              row.expectedCloseDate !== null &&
              row.expectedCloseDate >= monthStart &&
              row.expectedCloseDate < nextMonth,
          ).length,
        };
      }),
    };
  }

  async detail(actor: Actor, publicId: string) {
    const row = await this.prisma.salesOpportunity.findFirst({
      where: { tenantId: actor.tenantId, publicId, ...clientScope(actor) },
      select: {
        ...opportunitySelect,
        activities: {
          select: {
            publicId: true,
            type: true,
            summary: true,
            occurredAt: true,
            actor: { select: { displayName: true } },
          },
          orderBy: [{ occurredAt: "desc" }, { publicId: "desc" }],
          take: 20,
        },
      },
    });
    if (!row) throw new NotFoundException("Opportunity not found");
    const { publicId: id, activities, ...item } = row;
    return {
      id,
      ...item,
      activities: activities.map(({ publicId: activityId, ...activity }) => ({
        id: activityId,
        ...activity,
      })),
    };
  }
}

function savedViewWhere(
  actor: Actor,
  view: string | undefined,
  now: Date,
): Prisma.SalesOpportunityWhereInput {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  if (view === "mine") return { ownerId: actor.userId };
  if (view === "unassigned") return { ownerId: null };
  if (view === "high-value") return { estimatedValue: { gte: 1_500_000 } };
  if (view === "closing-month") {
    return { expectedCloseDate: { gte: monthStart, lt: nextMonth } };
  }
  if (view === "followup-overdue") {
    return { stage: { notIn: ["WON", "LOST"] }, nextFollowUpAt: { lt: now } };
  }
  if (view === "stale") {
    return {
      stage: { notIn: ["WON", "LOST"] },
      updatedAt: { lt: new Date(now.getTime() - 14 * 86_400_000) },
    };
  }
  if (view === "won-month" || view === "lost-month") {
    return {
      stage: view === "won-month" ? "WON" : "LOST",
      closedAt: { gte: monthStart, lt: nextMonth },
    };
  }
  return {};
}

function followUpWhere(
  filter: string | undefined,
  now: Date,
  today: Date,
  tomorrow: Date,
): Prisma.SalesOpportunityWhereInput {
  if (filter === "none") return { nextFollowUpAt: null };
  if (filter === "overdue") return { nextFollowUpAt: { lt: now } };
  if (filter === "today")
    return { nextFollowUpAt: { gte: today, lt: tomorrow } };
  if (filter === "upcoming") return { nextFollowUpAt: { gte: tomorrow } };
  return {};
}

function opportunityOrder(
  sort: string | undefined,
): Prisma.SalesOpportunityOrderByWithRelationInput[] {
  const primary: Prisma.SalesOpportunityOrderByWithRelationInput =
    sort === "value"
      ? { estimatedValue: "desc" }
      : sort === "probability"
        ? { probability: "desc" }
        : sort === "close"
          ? { expectedCloseDate: "asc" }
          : { updatedAt: "desc" };
  return [primary, { publicId: "asc" }];
}

function sumOpportunityValue(rows: Array<{ estimatedValue: unknown }>) {
  return rows.reduce((total, row) => total + Number(row.estimatedValue), 0);
}

function sumOpportunityWeighted(
  rows: Array<{ estimatedValue: unknown; probability: number }>,
) {
  return Math.round(
    rows.reduce(
      (total, row) =>
        total + Number(row.estimatedValue) * (row.probability / 100),
      0,
    ),
  );
}

function rate(won: number, closed: number) {
  return closed ? Math.round((won / closed) * 1000) / 10 : 0;
}
