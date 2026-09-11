import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import {
  operationsActionKinds,
  type OperationsActionQueryDto,
  type OperationsActionKind,
} from "./dto/operations-action-query.dto";
import { operationsWorkItems } from "./operations-action-query";

type CountRow = {
  action: OperationsActionKind;
  cases: number;
  quantity: number;
};
type WorkRow = {
  id: string;
  caseNumber: string;
  candidateName: string;
  clientName: string;
  status: string;
  priority: string;
  version: number;
  dueAt: Date | null;
  activityAt: Date;
  quantity: number;
  checksComplete: number;
};

@Injectable()
export class OperationsActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(actor: Actor, query: OperationsActionQueryDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can view the action inbox",
    );
    const generatedAt = new Date();
    const cte = operationsWorkItems(actor, generatedAt);
    const search = query.search?.trim() ?? "";
    const filter = Prisma.sql`w.[action] = ${query.action} ${
      search
        ? Prisma.sql`AND (
      CHARINDEX(${search}, s.[fullName]) > 0 OR CHARINDEX(${search}, w.[caseNumber]) > 0
      OR CHARINDEX(${search}, cl.[displayName]) > 0)`
        : Prisma.empty
    }`;
    const source = Prisma.sql`WorkItems w JOIN [dbo].[Subject] s ON s.[id] = w.[subjectId]
      JOIN [dbo].[Client] cl ON cl.[id] = w.[clientId]`;
    const counts = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`${cte}
      SELECT [action], COUNT(*) cases, SUM([quantity]) quantity FROM WorkItems GROUP BY [action]`);
    const summary = operationsActionKinds.map((action) => ({
      action,
      cases: counts.find((row) => row.action === action)?.cases ?? 0,
      quantity: counts.find((row) => row.action === action)?.quantity ?? 0,
    }));
    // Count filtered results in SQL; never derive global counts from one fetched page.
    const [count] = search
      ? await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`${cte}
          SELECT COUNT(*) total FROM ${source} WHERE ${filter}`)
      : [
          {
            total:
              summary.find((row) => row.action === query.action)?.cases ?? 0,
          },
        ];
    const total = count?.total ?? 0;
    const page = Math.min(
      query.page,
      Math.max(1, Math.ceil(total / query.pageSize)),
    );
    const rows = await this.prisma.$queryRaw<WorkRow[]>(Prisma.sql`${cte}
      SELECT CONVERT(varchar(36), w.[publicId]) id, w.[caseNumber], s.[fullName] candidateName,
        cl.[displayName] clientName, w.[status], w.[priority], w.[version], w.[dueAt],
        COALESCE(w.[activityAt], w.[updatedAt]) activityAt, w.[quantity], w.checksComplete
      FROM ${source} WHERE ${filter}
      ORDER BY CASE WHEN w.[dueAt] < ${generatedAt} THEN 0 ELSE 1 END,
        COALESCE(w.[activityAt], w.[updatedAt]) ASC, w.[id] ASC
      OFFSET ${(page - 1) * query.pageSize} ROWS FETCH NEXT ${query.pageSize} ROWS ONLY`);
    return {
      summary,
      items: rows,
      total,
      page,
      pageSize: query.pageSize,
      action: query.action,
      generatedAt,
    };
  }
}
