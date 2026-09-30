import { Injectable } from "@nestjs/common";
import { listAuditActivity } from "../../cases/audit-activity-page";
import type { Actor } from "../../common/auth/actor";
import { PrismaService } from "../../database/prisma.service";
import {
  vendorActivityMetadata,
  vendorActivityScope,
  vendorActivitySource,
} from "../vendor-activity.query";
import type { VendorLogQueryDto } from "../vendor-requests.validation";

interface VendorActivityRow {
  id: string;
  action: string;
  resourceType: string;
  createdAt: Date;
  actorName: string;
  byVendorTeam: boolean | number;
  requestId: string | null;
  caseNumber: string | null;
  documentType: string | null;
  teamUserName: string | null;
}

/**
 * Vendor Logs: the existing audit trail, scoped to the caller's vendor account (Main
 * Vendor) or to the requests delegated to it (team user), newest first, cursor-paged.
 */
@Injectable()
export class VendorActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, query: VendorLogQueryDto) {
    const { rows, nextCursor } = await listAuditActivity<VendorActivityRow>(
      this.prisma,
      {
        scope: vendorActivityScope(actor, query.requestId),
        metadata: vendorActivityMetadata(actor),
        source: vendorActivitySource(actor),
        query,
      },
    );
    // Explicit allowlist: no audit JSON, IP address, location or storage key.
    const items = rows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt,
      actorName: row.actorName,
      byVendorTeam: Boolean(row.byVendorTeam),
      request: row.requestId
        ? {
            id: row.requestId,
            caseNumber: row.caseNumber,
            documentType: row.documentType,
          }
        : null,
      teamUser: row.teamUserName,
    }));
    return { items, nextCursor };
  }
}
