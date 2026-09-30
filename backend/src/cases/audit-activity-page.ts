import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";

export interface AuditActivityQuery {
  cursor?: string;
  limit: number;
}

/**
 * One newest-first page of audit activity for a scope the caller has already
 * authorised (a SQL condition on `a`, the AuditEvent alias). Pages by
 * (createdAt, publicId) so equal timestamps never repeat or skip. Callers choose the
 * selected columns and must map rows to an explicit allowlist before returning them.
 */
export async function listAuditActivity<T extends { id: string }>(
  prisma: Pick<PrismaService, "$queryRaw">,
  input: {
    scope: Prisma.Sql;
    metadata: Prisma.Sql;
    source: Prisma.Sql;
    query: AuditActivityQuery;
  },
): Promise<{ rows: T[]; nextCursor: string | null }> {
  const { scope, metadata, source, query } = input;
  let pagination = Prisma.empty;
  if (query.cursor) {
    const anchors = await prisma.$queryRaw<
      Array<{ id: string; cursorTime: string }>
    >(Prisma.sql`
      SELECT CONVERT(varchar(36), a.[publicId]) AS [id],
        CONVERT(varchar(33), a.[createdAt], 126) AS [cursorTime]
      FROM [dbo].[AuditEvent] a WHERE ${scope}
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
  const rows = await prisma.$queryRaw<T[]>(Prisma.sql`
    SELECT TOP (${limit + 1}) ${metadata} FROM ${source}
    WHERE ${scope} ${pagination}
    ORDER BY a.[createdAt] DESC, a.[publicId] DESC`);
  const page = rows.slice(0, limit);
  return {
    rows: page,
    nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
  };
}
