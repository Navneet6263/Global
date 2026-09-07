import type { Actor } from "../common/auth/actor";
import type { PrismaService } from "../database/prisma.service";
import type { QaRegisterQueryDto } from "./dto/qa-register-query.dto";
import { qaScope, qaSearch } from "./qa-register";

export async function readQaHistory(
  prisma: PrismaService,
  actor: Actor,
  query: QaRegisterQueryDto,
) {
  // This is the current reviewer's decision history, not unscoped employee activity.
  const where = {
    reviewerId: actor.userId,
    case: { AND: [qaScope(actor), qaSearch(query.search)] },
  };
  const [rows, total] = await Promise.all([
    prisma.qaReview.findMany({
      where,
      select: {
        publicId: true,
        decision: true,
        notes: true,
        createdAt: true,
        case: {
          select: {
            publicId: true,
            caseNumber: true,
            status: true,
            subject: { select: { fullName: true } },
            client: { select: { displayName: true } },
            reports: {
              select: { status: true, currentVersion: true },
              orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
              take: 1,
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.qaReview.count({ where }),
  ]);
  return { items: rows, total, page: query.page, pageSize: query.limit };
}
