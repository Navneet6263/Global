import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { Prisma } from "../generated/prisma/client";
import { listAuditActivity } from "./audit-activity-page";
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
    return this.listForCase(actor.tenantId, row.id, publicId, query);
  }

  /**
   * Timeline for a case the caller has already authorised and resolved.
   * Shared by the operations endpoint above and the read-only /spoc monitor.
   */
  async listForCase(
    tenantId: bigint,
    caseId: bigint,
    publicId: string,
    query: CaseActivityQuery,
  ) {
    const filter = query.resource
      ? Prisma.sql`AND a.[resourceType] = ${query.resource}`
      : Prisma.empty;
    const { rows, nextCursor } = await listAuditActivity<CaseActivityRow>(
      this.prisma,
      {
        scope: Prisma.sql`${caseActivityScope(tenantId, caseId, publicId)} ${filter}`,
        metadata: activityMetadata,
        source: activitySource,
        query,
      },
    );
    // Explicit allowlist: never serialize audit JSON, IPs, location or object keys.
    const items = rows.map(
      ({ id, action, resourceType, actorName, createdAt }) => ({
        id,
        action,
        resourceType,
        actorName,
        createdAt,
      }),
    );
    return { items, nextCursor };
  }
}
