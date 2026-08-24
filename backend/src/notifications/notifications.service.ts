import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: Actor) {
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: {
          publicId: true,
          type: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { tenantId: actor.tenantId, userId: actor.userId, readAt: null },
      }),
    ]);
    return {
      unread,
      items: rows.map(({ publicId, ...item }) => ({ id: publicId, ...item })),
    };
  }

  async markRead(actor: Actor, publicId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        publicId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    if (!updated.count) {
      const exists = await this.prisma.notification.count({
        where: { tenantId: actor.tenantId, userId: actor.userId, publicId },
      });
      if (!exists) throw new NotFoundException("Notification not found");
    }
    return { read: true };
  }

  async markAllRead(actor: Actor) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId: actor.tenantId, userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: result.count };
  }
}
