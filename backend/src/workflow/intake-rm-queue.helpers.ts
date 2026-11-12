import { ForbiddenException } from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type { RmQueueQueryDto } from "./dto/workflow.dto";
import {
  RM_BUCKETS,
  presentQueueCase,
  queueCaseSelect,
  searchWhere,
} from "./intake-queue.presenter";
import {
  findConfirmedDeletedLinkIntakeIds,
  rmEligibleWhereWithLegacyIds,
} from "./intake-eligibility.helpers";
import { isSupervisor } from "./workflow-access";

export async function pageQueueCases(
  prisma: PrismaService,
  where: Prisma.VerificationCaseWhereInput,
  query: { page?: number; pageSize?: number },
  orderBy: Prisma.VerificationCaseOrderByWithRelationInput[],
  countWheres: Record<string, Prisma.VerificationCaseWhereInput>,
) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const keys = Object.keys(countWheres);
  const [rows, total, ...counts] = await Promise.all([
    prisma.verificationCase.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: queueCaseSelect,
    }),
    prisma.verificationCase.count({ where }),
    ...keys.map((key) =>
      prisma.verificationCase.count({ where: countWheres[key]! }),
    ),
  ]);
  return {
    items: rows.map(presentQueueCase),
    total,
    page,
    pageSize,
    counts: Object.fromEntries(
      keys.map((key, index) => [key, counts[index]!]),
    ),
    generatedAt: new Date(),
  };
}

/**
 * RM work queue scoped by Client-to-RM mapping (`caseAccessScope`, i.e., `actor.spocClients`)
 * rather than individual case ownership (`assignedOpsUserId`). Supervisors keep full view.
 */
export async function queryRmQueue(
  prisma: PrismaService,
  actor: Actor,
  query: RmQueueQueryDto,
) {
  const supervisor = isSupervisor(actor);
  if (!supervisor && !actor.roles.includes("SPOC_RM")) {
    throw new ForbiddenException("RM queue is for responsible RMs");
  }
  const base: Prisma.VerificationCaseWhereInput = {
    ...caseAccessScope(actor),
    workflowVersion: 2,
    ...(supervisor ? { assignedOpsUserId: { not: null } } : {}),
  };
  const bucket =
    query.bucket && query.bucket !== "all"
      ? RM_BUCKETS[query.bucket]
      : undefined;
  const flagWhere: Prisma.VerificationCaseWhereInput[] =
    query.flag === "escalated"
      ? [{ escalatedAt: { not: null } }]
      : query.flag === "overdue"
        ? [{ dueAt: { lt: new Date() } }]
        : [];
  const confirmedLegacyIds = await findConfirmedDeletedLinkIntakeIds(
    prisma,
    actor.tenantId,
  );
  const eligible = (
    ...extra: Array<Prisma.VerificationCaseWhereInput | undefined>
  ) => rmEligibleWhereWithLegacyIds(confirmedLegacyIds, base, ...extra);
  const where = eligible(
    ...(bucket ? [bucket] : []),
    ...(query.search ? [searchWhere(query.search)] : []),
    ...(query.clientId ? [{ client: { publicId: query.clientId } }] : []),
    ...flagWhere,
  );
  const counts = Object.fromEntries(
    Object.entries(RM_BUCKETS).map(([key, value]) => [key, eligible(value)]),
  );
  const [result, summary] = await Promise.all([
    pageQueueCases(
      prisma,
      where,
      query,
      query.sort === "newest"
        ? [{ createdAt: "desc" }, { publicId: "asc" }]
        : [{ dueAt: "asc" }, { updatedAt: "asc" }, { publicId: "asc" }],
      counts,
    ),
    queryRmSummary(prisma, base, confirmedLegacyIds),
  ]);
  return { ...result, summary };
}

async function queryRmSummary(
  prisma: PrismaService,
  base: Prisma.VerificationCaseWhereInput,
  confirmedLegacyIds: readonly bigint[],
) {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60_000);
  const endOfDay = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1) -
      330 * 60_000,
  );
  const active: Prisma.VerificationCaseWhereInput = rmEligibleWhereWithLegacyIds(
    confirmedLegacyIds,
    base,
  );
  const overdueWhere = { ...active, dueAt: { lt: now } };
  const [
    activeCount,
    overdue,
    dueToday,
    completedThisWeek,
    byClient,
    overdueByClient,
    escalated,
  ] = await Promise.all([
    prisma.verificationCase.count({ where: active }),
    prisma.verificationCase.count({ where: overdueWhere }),
    prisma.verificationCase.count({
      where: { ...active, dueAt: { gte: now, lt: endOfDay } },
    }),
    prisma.verificationCase.count({
      where: {
        ...base,
        status: { in: ["COMPLETED", "CLOSED"] },
        updatedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
      },
    }),
    prisma.verificationCase.groupBy({
      by: ["clientId"],
      where: active,
      _count: { _all: true },
    }),
    prisma.verificationCase.groupBy({
      by: ["clientId"],
      where: overdueWhere,
      _count: { _all: true },
    }),
    prisma.verificationCase.count({
      where: { ...active, escalatedAt: { not: null } },
    }),
  ]);
  const top = [...byClient]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 6);
  const names = top.length
    ? await prisma.client.findMany({
        where: { id: { in: top.map((row) => row.clientId) } },
        select: { id: true, publicId: true, displayName: true },
      })
    : [];
  return {
    active: activeCount,
    overdue,
    dueToday,
    completedThisWeek,
    escalated,
    clients: top.flatMap((row) => {
      const client = names.find((item) => item.id === row.clientId);
      if (!client) return [];
      return [
        {
          id: client.publicId,
          name: client.displayName,
          active: row._count._all,
          overdue:
            overdueByClient.find((item) => item.clientId === row.clientId)
              ?._count._all ?? 0,
        },
      ];
    }),
  };
}
