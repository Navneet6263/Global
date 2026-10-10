import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import {
  NotificationCategories,
  categoryOf,
  categoryWhere,
  type NotificationCategory,
} from "./notification-categories";

export interface NotificationQuery {
  cursor?: string;
  limit?: number;
  unread?: boolean;
  category?: NotificationCategory;
  search?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The signed-in user's inbox, newest first, a page at a time (cursor = the last id
   * of the previous page). Filters: unread only, category and text search. Counts per
   * category always cover the whole inbox so the filter chips stay stable.
   */
  async list(actor: Actor, query: NotificationQuery = {}) {
    const mine = { tenantId: actor.tenantId, userId: actor.userId };
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const search = query.search?.trim().slice(0, 100);
    const filters: Prisma.NotificationWhereInput[] = [mine];
    if (query.unread) filters.push({ readAt: null });
    if (query.category) filters.push(categoryWhere(query.category));
    if (search)
      filters.push({
        OR: [{ title: { contains: search } }, { body: { contains: search } }],
      });
    if (query.cursor) {
      const last = await this.prisma.notification.findFirst({
        where: { ...mine, publicId: query.cursor },
        select: { id: true, createdAt: true },
      });
      if (last)
        filters.push({
          OR: [
            { createdAt: { lt: last.createdAt } },
            { createdAt: last.createdAt, id: { lt: last.id } },
          ],
        });
    }
    const [rows, unread, byType] = await Promise.all([
      this.prisma.notification.findMany({
        where: { AND: filters },
        select: {
          publicId: true,
          type: true,
          title: true,
          body: true,
          href: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
      }),
      this.prisma.notification.count({ where: { ...mine, readAt: null } }),
      this.prisma.notification.groupBy({
        by: ["type"],
        where: mine,
        _count: { _all: true },
      }),
    ]);
    const unreadByType = await this.prisma.notification.groupBy({
      by: ["type"],
      where: { ...mine, readAt: null },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(
      NotificationCategories.map((name) => [name, { total: 0, unread: 0 }]),
    ) as Record<NotificationCategory, { total: number; unread: number }>;
    for (const row of byType)
      counts[categoryOf(row.type)].total += row._count._all;
    for (const row of unreadByType)
      counts[categoryOf(row.type)].unread += row._count._all;
    const page = rows.slice(0, limit);
    return {
      unread,
      total: byType.reduce((sum, row) => sum + row._count._all, 0),
      counts,
      nextCursor: rows.length > limit ? (page.at(-1)?.publicId ?? null) : null,
      items: page.map(({ publicId, ...item }) => ({
        id: publicId,
        ...item,
        category: categoryOf(item.type),
      })),
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
    if (!updated.count) await this.assertExists(actor, publicId);
    return { read: true };
  }

  /** Puts a notification back in the unread list. */
  async markUnread(actor: Actor, publicId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { tenantId: actor.tenantId, userId: actor.userId, publicId },
      data: { readAt: null },
    });
    if (!updated.count) throw new NotFoundException("Notification not found");
    return { read: false };
  }

  async markAllRead(actor: Actor) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId: actor.tenantId, userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { read: result.count };
  }

  private async assertExists(actor: Actor, publicId: string) {
    const exists = await this.prisma.notification.count({
      where: { tenantId: actor.tenantId, userId: actor.userId, publicId },
    });
    if (!exists) throw new NotFoundException("Notification not found");
  }
}
