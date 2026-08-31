import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import type { PageQueryDto } from "../common/dto/page-query.dto";
import { PrismaService } from "../database/prisma.service";
import { networkLocationLabel } from "../common/http/network-location";

@Injectable()
export class SessionManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async sessions(actor: Actor) {
    const currentSessionId = this.currentSessionId(actor);
    const [rows, user] = await Promise.all([
      this.prisma.refreshSession.findMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          publicId: true,
          userAgent: true,
          ipAddress: true,
          deviceName: true,
          deviceKey: true,
          familyId: true,
          locationLabel: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { passwordChangedAt: true },
      }),
    ]);
    const seenDevices = new Set<string>();
    const devices = rows.filter((row) => {
      const key = row.deviceKey
        ? `device:${row.deviceKey}`
        : `family:${row.familyId}`;
      if (seenDevices.has(key)) return false;
      seenDevices.add(key);
      return true;
    });
    return {
      items: devices.map((row) => ({
        id: row.publicId,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        deviceName: row.deviceName,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        locationLabel: networkLocationLabel(row.ipAddress, row.locationLabel),
        current: row.publicId === currentSessionId,
      })),
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  async securityEvents(actor: Actor, query: PageQueryDto) {
    const where = {
      tenantId: actor.tenantId,
      actorUserId: actor.userId,
      action: { startsWith: "auth." },
    } as const;
    const [rows, total, attention] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        select: {
          publicId: true,
          action: true,
          ipAddress: true,
          locationLabel: true,
          afterJson: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { publicId: "desc" }],
        take: query.limit + 1,
        ...(query.cursor
          ? { cursor: { publicId: query.cursor }, skip: 1 }
          : {}),
      }),
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.count({
        where: {
          ...where,
          OR: [
            { action: { contains: "failed" } },
            { action: { contains: "reuse" } },
          ],
        },
      }),
    ]);
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(({ publicId: id, ...event }) => ({
        id,
        ...event,
        locationLabel: networkLocationLabel(
          event.ipAddress,
          event.locationLabel,
        ),
        risk:
          event.action.includes("failed") || event.action.includes("reuse")
            ? "ATTENTION"
            : "NORMAL",
      })),
      nextCursor: hasMore ? page.at(-1)?.publicId : null,
      summary: { total, attention },
    };
  }

  async rename(actor: Actor, sessionPublicId: string, name: string) {
    const normalizedName = name.trim();
    const target = await this.prisma.refreshSession.findFirst({
      where: {
        userId: actor.userId,
        publicId: sessionPublicId,
        revokedAt: null,
      },
      select: { familyId: true, deviceKey: true },
    });
    if (!target) throw new NotFoundException("Active session not found");
    const updated = await this.prisma.refreshSession.updateMany({
      where: {
        userId: actor.userId,
        revokedAt: null,
        ...(target.deviceKey
          ? { deviceKey: target.deviceKey }
          : { familyId: target.familyId }),
      },
      data: { deviceName: normalizedName },
    });
    if (updated.count < 1) {
      throw new NotFoundException("Active session not found");
    }
    await this.prisma.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "auth.session.renamed",
        resourceType: "user",
        resourcePublicId: actor.userPublicId,
        afterJson: JSON.stringify({
          sessionId: sessionPublicId,
          name: normalizedName,
        }),
      },
    });
    return { id: sessionPublicId, name: normalizedName };
  }

  async revokeOthers(actor: Actor) {
    const currentSessionId = this.currentSessionId(actor);
    const current = await this.prisma.refreshSession.findFirst({
      where: {
        userId: actor.userId,
        publicId: currentSessionId,
        revokedAt: null,
      },
      select: { familyId: true, deviceKey: true },
    });
    if (!current) {
      throw new UnauthorizedException("Current session is unavailable");
    }
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          userId: actor.userId,
          revokedAt: null,
          ...(current.deviceKey
            ? {
                OR: [
                  { deviceKey: { not: current.deviceKey } },
                  { deviceKey: null },
                ],
              }
            : { familyId: { not: current.familyId } }),
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "auth.sessions.others-revoked",
          resourceType: "user",
          resourcePublicId: actor.userPublicId,
          afterJson: JSON.stringify({ revoked: revoked.count }),
        },
      });
      return { revoked: revoked.count };
    });
  }

  async revoke(actor: Actor, sessionPublicId: string) {
    const current = sessionPublicId === this.currentSessionId(actor);
    const target = await this.prisma.refreshSession.findFirst({
      where: {
        userId: actor.userId,
        publicId: sessionPublicId,
        revokedAt: null,
      },
      select: { familyId: true, deviceKey: true },
    });
    if (!target) throw new NotFoundException("Active session not found");
    return this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: {
          userId: actor.userId,
          ...(target.deviceKey
            ? { deviceKey: target.deviceKey }
            : { familyId: target.familyId }),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "auth.session.revoked",
          resourceType: "user",
          resourcePublicId: actor.userPublicId,
          afterJson: JSON.stringify({
            sessionId: sessionPublicId,
            current,
            revoked: revoked.count,
          }),
        },
      });
      return { revoked: revoked.count, current };
    });
  }

  private currentSessionId(actor: Actor): string {
    if (!actor.sessionPublicId) {
      throw new UnauthorizedException("Current session is unavailable");
    }
    return actor.sessionPublicId;
  }
}
