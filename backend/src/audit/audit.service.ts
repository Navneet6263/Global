import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor, cursor?: string, limit = 50) {
    const rows = await this.prisma.auditEvent.findMany({
      where: { tenantId: actor.tenantId },
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
      take: Math.min(limit, 100) + 1,
      ...(cursor ? { cursor: { publicId: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > Math.min(limit, 100);
    const page = hasMore ? rows.slice(0, -1) : rows;
    return {
      items: page.map(({ publicId, ...event }) => ({ id: publicId, ...event })),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
    };
  }
}
