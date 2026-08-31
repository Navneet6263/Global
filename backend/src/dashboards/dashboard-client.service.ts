import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class DashboardClientService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor) {
    const scope = caseAccessScope(actor);
    const now = new Date();
    const [stages, checks, documents, qaReviews] = await Promise.all([
      this.prisma.verificationCase.groupBy({
        by: ["status"],
        where: scope,
        _count: { _all: true },
        _min: { updatedAt: true },
      }),
      this.prisma.caseCheck.groupBy({
        by: ["type", "status", "result"],
        where: { tenantId: actor.tenantId, case: scope },
        _count: { _all: true },
      }),
      this.prisma.document.groupBy({
        by: ["type", "status"],
        where: { tenantId: actor.tenantId, case: scope },
        _count: { _all: true },
      }),
      this.prisma.qaReview.groupBy({
        by: ["decision"],
        where: { case: scope },
        _count: { _all: true },
      }),
    ]);

    const checkHealth = aggregateChecks(checks);
    const documentHealth = aggregateDocuments(documents);
    const returnedOutcomes = checkHealth.reduce(
      (sum, row) => sum + row.returned,
      0,
    );
    const nonClear = checkHealth.reduce(
      (sum, row) => sum + row.discrepancies + row.unableToVerify,
      0,
    );
    const rejectedDocuments = documentHealth.reduce(
      (sum, row) => sum + row.rejected,
      0,
    );
    const stageHealth = stages
      .map((row) => ({
        status: row.status,
        count: row._count._all,
        oldestAgeHours: row._min.updatedAt
          ? Math.max(
              0,
              Math.round(
                (now.getTime() - row._min.updatedAt.getTime()) / 3_600_000,
              ),
            )
          : 0,
      }))
      .sort((a, b) => b.count - a.count);
    const bottleneck = stageHealth.find(
      (row) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(row.status),
    );

    return {
      summary: {
        totalChecks: checkHealth.reduce((sum, row) => sum + row.total, 0),
        returnedOutcomes,
        nonClear,
        nonClearRate: returnedOutcomes
          ? Math.round((nonClear / returnedOutcomes) * 1_000) / 10
          : 0,
        rejectedDocuments,
        qaRework:
          qaReviews.find((row) => row.decision === "REWORK")?._count._all ?? 0,
      },
      bottleneck: bottleneck ?? null,
      stageHealth,
      checkHealth,
      documentHealth,
      qaDecisions: Object.fromEntries(
        qaReviews.map((row) => [row.decision, row._count._all]),
      ),
      generatedAt: now,
    };
  }
}

type CheckGroup = {
  type: string;
  status: string;
  result: string | null;
  _count: { _all: number };
};

function aggregateChecks(rows: CheckGroup[]) {
  const groups = new Map<
    string,
    {
      type: string;
      total: number;
      completed: number;
      pending: number;
      returned: number;
      clear: number;
      discrepancies: number;
      unableToVerify: number;
    }
  >();
  for (const row of rows) {
    const item = groups.get(row.type) ?? {
      type: row.type,
      total: 0,
      completed: 0,
      pending: 0,
      returned: 0,
      clear: 0,
      discrepancies: 0,
      unableToVerify: 0,
    };
    item.total += row._count._all;
    if (row.status === "COMPLETED") item.completed += row._count._all;
    else item.pending += row._count._all;
    if (row.result) item.returned += row._count._all;
    if (row.result === "CLEAR") item.clear += row._count._all;
    if (row.result === "DISCREPANCY") item.discrepancies += row._count._all;
    if (row.result === "UNABLE_TO_VERIFY")
      item.unableToVerify += row._count._all;
    groups.set(row.type, item);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.discrepancies +
        b.unableToVerify -
        (a.discrepancies + a.unableToVerify) || b.total - a.total,
  );
}

type DocumentGroup = {
  type: string;
  status: string;
  _count: { _all: number };
};

function aggregateDocuments(rows: DocumentGroup[]) {
  const groups = new Map<
    string,
    {
      type: string;
      total: number;
      available: number;
      verified: number;
      rejected: number;
    }
  >();
  for (const row of rows) {
    const item = groups.get(row.type) ?? {
      type: row.type,
      total: 0,
      available: 0,
      verified: 0,
      rejected: 0,
    };
    item.total += row._count._all;
    if (row.status === "AVAILABLE") item.available += row._count._all;
    if (row.status === "VERIFIED") item.verified += row._count._all;
    if (row.status === "REJECTED") item.rejected += row._count._all;
    groups.set(row.type, item);
  }
  return [...groups.values()].sort(
    (a, b) => b.rejected - a.rejected || b.total - a.total,
  );
}
