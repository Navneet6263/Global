import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import {
  activityMetadata,
  activitySource,
  caseActivityScope,
} from "./case-activity.query";

export interface CaseActivityQuery {
  cursor?: string;
  limit: number;
  resource?: string;
}
export interface CaseActivityRow {
  id: string;
  action: string;
  resourceType: string;
  createdAt: Date;
  actorName: string;
}

@Injectable()
export class CaseActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, publicId: string, query: CaseActivityQuery) {
    if (
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Case activity is available to operations managers and platform administrators only",
      );
    }
    const row = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException("Case not found");
    const scope = caseActivityScope(actor.tenantId, row.id, publicId);
    const filter = query.resource
      ? Prisma.sql`AND a.[resourceType] = ${query.resource}`
      : Prisma.empty;
    let pagination = Prisma.empty;
    if (query.cursor) {
      const anchors = await this.prisma.$queryRaw<
        Array<{ id: string; cursorTime: string }>
      >(Prisma.sql`
        SELECT CONVERT(varchar(36), a.[publicId]) AS [id],
          CONVERT(varchar(33), a.[createdAt], 126) AS [cursorTime]
        FROM [dbo].[AuditEvent] a WHERE ${scope} ${filter}
        AND a.[publicId] = CONVERT(uniqueidentifier, ${query.cursor})`);
      const anchor = anchors[0];
      if (!anchor)
        throw new BadRequestException(
          "Activity page has changed; return to the first page",
        );
      // Keep SQL DATETIME2's seven-digit precision: JS Date truncates to ms.
      pagination = Prisma.sql`AND (a.[createdAt] < CONVERT(datetime2, ${anchor.cursorTime}, 126) OR
        (a.[createdAt] = CONVERT(datetime2, ${anchor.cursorTime}, 126) AND a.[publicId] < CONVERT(uniqueidentifier, ${anchor.id})))`;
    }
    const limit = Math.min(50, Math.max(1, query.limit));
    const rows = await this.prisma.$queryRaw<CaseActivityRow[]>(Prisma.sql`
      SELECT TOP (${limit + 1}) ${activityMetadata} FROM ${activitySource}
      WHERE ${scope} ${filter} ${pagination}
      ORDER BY a.[createdAt] DESC, a.[publicId] DESC`);
    const hasMore = rows.length > limit;
    // Explicit allowlist: never serialize audit JSON, IPs, location or object keys.
    const items = rows
      .slice(0, limit)
      .map(({ id, action, resourceType, actorName, createdAt }) => ({
        id,
        action,
        resourceType,
        actorName,
        createdAt,
      }));
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  }
}
