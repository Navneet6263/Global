import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

type AuditFilters = {
  page: number;
  pageSize: number;
  search?: string;
  actor?: string;
  resourceType?: string;
  category?: string;
  from?: string;
  to?: string;
};

const categoryTerms: Record<string, string[]> = {
  access: ["auth", "user", "session"],
  case: ["case", "verification", "clarification", "field", "qa"],
  client: ["client"],
  document: ["document"],
  policy: ["policy", "settings"],
  report: ["report"],
  finance: ["invoice", "finance", "payment", "credit"],
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: AuditFilters) {
    const search = query.search?.trim();
    const terms = query.category ? (categoryTerms[query.category] ?? []) : [];
    const where = {
      tenantId: actor.tenantId,
      ...(query.actor === "System"
        ? { actorUserId: null }
        : query.actor
          ? { actor: { displayName: query.actor } }
          : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to
                ? { lte: new Date(`${query.to.slice(0, 10)}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search } },
              { resourceType: { contains: search } },
              { resourcePublicId: { contains: search } },
              { requestId: { contains: search } },
              { actor: { displayName: { contains: search } } },
              { actor: { email: { contains: search } } },
            ],
          }
        : {}),
      ...(terms.length
        ? {
            AND: [
              {
                OR: terms.flatMap((term) => [
                  { action: { contains: term } },
                  { resourceType: { contains: term } },
                ]),
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        select: {
          publicId: true,
          action: true,
          resourceType: true,
          resourcePublicId: true,
          requestId: true,
          ipAddress: true,
          beforeJson: true,
          afterJson: true,
          createdAt: true,
          actor: { select: { publicId: true, displayName: true, email: true } },
        },
        orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditEvent.count({ where }),
    ]);
    return {
      items: rows.map(({ publicId, ...event }) => ({ id: publicId, ...event })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async facets(actor: Actor) {
    const [actorGroups, resourceGroups] = await Promise.all([
      this.prisma.auditEvent.groupBy({
        by: ["actorUserId"],
        where: { tenantId: actor.tenantId, actorUserId: { not: null } },
      }),
      this.prisma.auditEvent.groupBy({
        by: ["resourceType"],
        where: { tenantId: actor.tenantId },
        orderBy: { resourceType: "asc" },
      }),
    ]);
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        id: {
          in: actorGroups.flatMap((row) =>
            row.actorUserId ? [row.actorUserId] : [],
          ),
        },
      },
      select: { displayName: true },
      orderBy: { displayName: "asc" },
    });
    return {
      actors: ["System", ...new Set(users.map((user) => user.displayName))],
      resourceTypes: resourceGroups.map((row) => row.resourceType),
    };
  }
}
