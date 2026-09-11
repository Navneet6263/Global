import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { QaQueryDto } from "./dto/qa-query.dto";
import { claimCutoff } from "./qa-claim";
import { qaDetailSelect } from "./qa-projection";
import { fieldQaWhere } from "../field-visits/physical-field-policy";

export async function readQaQueue(
  prisma: PrismaService,
  actor: Actor,
  query: QaQueryDto,
) {
  const now = new Date();
  const baseWhere = {
    tenantId: actor.tenantId,
    ...(actor.branchId ? { branchId: actor.branchId } : {}),
    ...(actor.clientId ? { clientId: actor.clientId } : {}),
    status: "QA_REVIEW",
    AND: [fieldQaWhere()],
  };
  const search = query.search?.trim();
  const [rows, awaiting, overdue, highRisk, claimed] = await Promise.all([
    prisma.verificationCase.findMany({
      where: {
        ...baseWhere,
        ...(search
          ? {
              OR: [
                { caseNumber: { contains: search } },
                { subject: { fullName: { contains: search } } },
                { client: { displayName: { contains: search } } },
              ],
            }
          : {}),
      },
      select: qaDetailSelect,
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    }),
    prisma.verificationCase.count({ where: baseWhere }),
    prisma.verificationCase.count({
      where: { ...baseWhere, dueAt: { lt: now } },
    }),
    prisma.verificationCase.count({
      where: {
        ...baseWhere,
        checks: { some: { riskLevel: { in: ["HIGH", "CRITICAL"] } } },
      },
    }),
    prisma.verificationCase.count({
      where: {
        ...baseWhere,
        qaReviewerId: { not: null },
        qaClaimedAt: { gt: claimCutoff() },
      },
    }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const items = page.map(({ publicId, ...row }) => ({
    id: publicId,
    ...row,
  }));
  return {
    items,
    nextCursor: hasMore ? page.at(-1)?.publicId : null,
    summary: {
      awaiting,
      overdue,
      highRisk,
      claimed,
    },
  };
}
