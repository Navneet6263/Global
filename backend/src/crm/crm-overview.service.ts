import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { clientScope } from "./crm-opportunity.shared";
import { OpportunityStages } from "./dto/create-opportunity.dto";

@Injectable()
export class CrmOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const now = new Date();
    const months = monthWindows(now);
    const trendStart = months[0]!.start;
    const scope = { tenantId: actor.tenantId, ...clientScope(actor) };
    const [stages, activeRows, activities, trendRows] = await Promise.all([
      this.prisma.salesOpportunity.groupBy({
        by: ["stage"],
        where: scope,
        _count: { _all: true },
        _sum: { estimatedValue: true },
      }),
      this.prisma.salesOpportunity.findMany({
        where: { ...scope, stage: { notIn: ["WON", "LOST"] } },
        select: {
          publicId: true,
          companyName: true,
          contactName: true,
          stage: true,
          estimatedValue: true,
          probability: true,
          ownerId: true,
          owner: { select: { displayName: true } },
          createdAt: true,
          updatedAt: true,
          nextFollowUpAt: true,
          notes: true,
        },
      }),
      this.prisma.salesActivity.findMany({
        where: { tenantId: actor.tenantId, opportunity: clientScope(actor) },
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
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
      this.prisma.salesOpportunity.findMany({
        where: {
          ...scope,
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
      }),
    ]);

    const stageMap = new Map(stages.map((row) => [row.stage, row]));
    const wonCount = stageMap.get("WON")?._count._all ?? 0;
    const lostCount = stageMap.get("LOST")?._count._all ?? 0;
    const followUps = activeRows.filter((row) => row.nextFollowUpAt);
    const overdue = followUps.filter((row) => row.nextFollowUpAt! < now);
    const openValue = sumValue(activeRows);
    const weightedValue = sumWeighted(activeRows);

    return {
      summary: {
        openCount: activeRows.length,
        openValue,
        weightedValue,
        activeOwners: uniqueOwnerCount(activeRows),
        wonValue: Number(stageMap.get("WON")?._sum.estimatedValue ?? 0),
        wonCount,
        lostCount,
        winRate: rate(wonCount, wonCount + lostCount),
        pendingFollowUps: followUps.length,
        overdueFollowUps: overdue.length,
        unassignedOpportunities: activeRows.filter(
          (row) => row.ownerId === null,
        ).length,
      },
      stages: OpportunityStages.map((stage) => {
        const grouped = stageMap.get(stage);
        const openStageRows = activeRows.filter((row) => row.stage === stage);
        return {
          stage,
          count: grouped?._count._all ?? 0,
          value: Number(grouped?._sum.estimatedValue ?? 0),
          weightedValue:
            stage === "WON"
              ? Number(grouped?._sum.estimatedValue ?? 0)
              : stage === "LOST"
                ? 0
                : sumWeighted(openStageRows),
          averageAgeDays: openStageRows.length
            ? averageAgeDays(openStageRows, now)
            : null,
          conversionFromPrevious: null,
          overdueFollowUps: openStageRows.filter(
            (row) => row.nextFollowUpAt !== null && row.nextFollowUpAt < now,
          ).length,
        };
      }),
      activities: activities.map(({ publicId, ...activity }) => ({
        id: publicId,
        ...activity,
      })),
      followUps: followUps
        .sort(
          (a, b) => a.nextFollowUpAt!.getTime() - b.nextFollowUpAt!.getTime(),
        )
        .slice(0, 20)
        .map((row) => ({
          opportunityId: row.publicId,
          companyName: row.companyName,
          contactName: row.contactName,
          ownerName: row.owner?.displayName ?? null,
          stage: row.stage,
          estimatedValue: Number(row.estimatedValue),
          dueAt: row.nextFollowUpAt!,
          notes: row.notes,
          lastActivityAt: row.updatedAt,
        })),
      trend: months.map((window) => trendPoint(window, trendRows)),
      generatedAt: now,
    };
  }
}

function trendPoint(
  { start, end, label }: ReturnType<typeof monthWindows>[number],
  rows: Array<{
    createdAt: Date;
    closedAt: Date | null;
    stage: string;
    estimatedValue: unknown;
    probability: number;
    ownerId: bigint | null;
  }>,
) {
  const created = rows.filter(
    (row) => row.createdAt >= start && row.createdAt < end,
  );
  const closed = rows.filter(
    (row) => row.closedAt && row.closedAt >= start && row.closedAt < end,
  );
  const won = closed.filter((row) => row.stage === "WON");
  const lost = closed.filter((row) => row.stage === "LOST");
  return {
    month: label,
    pipelineValue: sumValue(created),
    weightedValue: sumWeighted(created),
    wonValue: sumValue(won),
    winRate: rate(won.length, won.length + lost.length),
    activeOwners: uniqueOwnerCount(created),
  };
}

function monthWindows(now: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1),
    );
    return {
      start,
      end: new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
      ),
      label: start.toLocaleString("en", { month: "short", timeZone: "UTC" }),
    };
  });
}

function uniqueOwnerCount(rows: Array<{ ownerId: bigint | null }>) {
  return new Set(
    rows.flatMap((row) =>
      row.ownerId === null ? [] : [row.ownerId.toString()],
    ),
  ).size;
}

function sumValue(rows: Array<{ estimatedValue: unknown }>) {
  return rows.reduce((sum, row) => sum + Number(row.estimatedValue), 0);
}

function sumWeighted(
  rows: Array<{ estimatedValue: unknown; probability: number }>,
) {
  const value = rows.reduce(
    (sum, row) => sum + Number(row.estimatedValue) * (row.probability / 100),
    0,
  );
  return Math.round(value * 100) / 100;
}

function averageAgeDays(rows: Array<{ createdAt: Date }>, now: Date) {
  return Math.round(
    rows.reduce(
      (sum, row) =>
        sum + (now.getTime() - row.createdAt.getTime()) / 86_400_000,
      0,
    ) / rows.length,
  );
}

function rate(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}
