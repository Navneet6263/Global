import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { hasAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";

export type MineTaskQuery = {
  status?: string;
  view?: string;
  search?: string;
  cursor?: string;
  limit: number;
};

@Injectable()
export class TaskQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor, query: MineTaskQuery) {
    const search = query.search?.trim();
    const supervisor = hasAnyRole(actor, OPERATIONS_ROLES);
    const access = {
      tenantId: actor.tenantId,
      ...(!supervisor ? { assigneeId: actor.userId } : {}),
      ...(actor.branchId || actor.clientId
        ? {
            check: {
              case: {
                ...(actor.branchId ? { branchId: actor.branchId } : {}),
                ...(actor.clientId ? { clientId: actor.clientId } : {}),
              },
            },
          }
        : {}),
    };
    const where = {
      ...access,
      status:
        query.view === "ACTIVE"
          ? { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] }
          : query.status,
      ...(search
        ? {
            AND: [
              {
                check: {
                  OR: [
                    { type: { contains: search } },
                    { case: { caseNumber: { contains: search } } },
                    { case: { subject: { fullName: { contains: search } } } },
                    {
                      case: { client: { displayName: { contains: search } } },
                    },
                  ],
                },
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.checkTask.findMany({
      where,
      select: {
        publicId: true,
        status: true,
        instructions: true,
        dueAt: true,
        startedAt: true,
        completedAt: true,
        blockerReason: true,
        blockedAt: true,
        version: true,
        check: {
          select: {
            publicId: true,
            type: true,
            status: true,
            result: true,
            riskLevel: true,
            sourceSummary: true,
            findings: {
              select: {
                publicId: true,
                kind: true,
                severity: true,
                title: true,
                description: true,
                source: true,
              },
              orderBy: { createdAt: "asc" },
            },
            case: {
              select: {
                publicId: true,
                caseNumber: true,
                priority: true,
                subject: { select: { publicId: true, fullName: true } },
                client: { select: { publicId: true, displayName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { publicId: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { publicId: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const [active, overdue, blocked, completedToday] = await Promise.all([
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { in: ["UNASSIGNED", "OPEN", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: { not: "COMPLETED" },
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.checkTask.count({ where: { ...access, status: "BLOCKED" } }),
      this.prisma.checkTask.count({
        where: {
          ...access,
          status: "COMPLETED",
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);
    return {
      items: page.map(({ publicId, ...row }) => ({ id: publicId, ...row })),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      summary: { active, overdue, blocked, completedToday },
    };
  }
}
