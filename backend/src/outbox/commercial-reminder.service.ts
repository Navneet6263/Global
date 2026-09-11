import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { deduplicatedNotice } from "./deduplicated-notice";

export function collectionNotice(daysOverdue: number) {
  if (daysOverdue >= 30)
    return {
      type: "COLLECTION_MANAGER_REVIEW",
      title: "Overdue balance needs manager review",
      managers: true,
    };
  if (daysOverdue >= 7)
    return {
      type: "COLLECTION_FOLLOW_UP",
      title: "Invoice payment follow-up due",
      managers: false,
    };
  return {
    type: "COLLECTION_OVERDUE",
    title: "Invoice is overdue",
    managers: false,
  };
}

@Injectable()
export class CommercialReminderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private running = false;
  private opportunityCursor = 0n;
  private invoiceCursor = 0n;
  private readonly logger = new Logger(CommercialReminderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}
  onApplicationBootstrap() {
    if (
      !this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true) ||
      !["all", "worker"].includes(
        this.config.get<string>("PROCESS_ROLE", "all"),
      )
    )
      return;
    this.timer = setInterval(() => void this.run(), 60_000);
    this.timer.unref();
    void this.run();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.sales();
      await this.collections();
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Commercial reminder scan failed",
      );
    } finally {
      this.running = false;
    }
  }
  private async sales() {
    const now = new Date();
    const rows = await this.prisma.salesOpportunity.findMany({
      where: {
        id: { gt: this.opportunityCursor },
        stage: { notIn: ["WON", "LOST"] },
        nextFollowUpAt: { lte: now },
      },
      orderBy: { id: "asc" },
      take: 100,
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clientId: true,
        companyName: true,
        ownerId: true,
        nextFollowUpAt: true,
      },
    });
    this.opportunityCursor = rows.length === 100 ? rows[99]!.id : 0n;
    for (const row of rows) {
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: row.tenantId,
          status: "ACTIVE",
          OR: [
            { clientId: null },
            ...(row.clientId ? [{ clientId: row.clientId }] : []),
          ],
          AND: [
            {
              OR: [
                ...(row.ownerId
                  ? [
                      {
                        id: row.ownerId,
                        userRoles: {
                          some: {
                            role: {
                              code: { in: ["SALES_MANAGER", "PLATFORM_ADMIN"] },
                            },
                          },
                        },
                      },
                    ]
                  : []),
                { userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } } },
              ],
            },
          ],
        },
        select: { id: true },
      });
      await deduplicatedNotice(
        this.prisma,
        {
          tenantId: row.tenantId,
          resource: row.publicId,
          type: "CRM_FOLLOW_UP_DUE",
          title: "Sales follow-up is due",
          body: `${row.companyName}: record your contact attempt and complete or reschedule the follow-up.`,
          href: `/sales-crm/follow-ups?opportunity=${row.publicId}`,
          users: users.map((x) => x.id),
        },
        now,
      );
    }
  }
  private async collections() {
    const now = new Date();
    const rows = await this.prisma.invoice.findMany({
      where: {
        id: { gt: this.invoiceCursor },
        status: {
          in: ["ISSUED", "PARTIALLY_PAID", "PARTIALLY_CREDITED", "OVERDUE"],
        },
        dueAt: { lt: now },
      },
      orderBy: { id: "asc" },
      take: 100,
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clientId: true,
        invoiceNumber: true,
        dueAt: true,
      },
    });
    this.invoiceCursor = rows.length === 100 ? rows[99]!.id : 0n;
    for (const row of rows) {
      const notice = collectionNotice(
        Math.floor((now.getTime() - row.dueAt!.getTime()) / 86_400_000),
      );
      const users = await this.prisma.user.findMany({
        where: {
          tenantId: row.tenantId,
          status: "ACTIVE",
          OR: [{ clientId: null }, { clientId: row.clientId }],
          userRoles: {
            some: {
              role: {
                code: {
                  in: notice.managers
                    ? ["FINANCE_MANAGER", "PLATFORM_ADMIN"]
                    : ["FINANCE_MANAGER"],
                },
              },
            },
          },
        },
        select: { id: true },
      });
      await deduplicatedNotice(
        this.prisma,
        {
          ...notice,
          tenantId: row.tenantId,
          resource: row.publicId,
          body: `${row.invoiceNumber}: review outstanding payment and record the collection action. Report payment gates have not changed.`,
          href: `/finance?invoice=${row.publicId}`,
          users: users.map((x) => x.id),
        },
        now,
      );
    }
  }
}
