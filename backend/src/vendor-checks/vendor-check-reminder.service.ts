import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";

export const VENDOR_REMINDER_EVERY_MS = 24 * 3_600_000;

/**
 * Overdue vendor checks: once a day the vendor (or its team user) is reminded and the
 * person who assigned the check is told it is late. Spaced by lastRemindedAt; audited.
 */
@Injectable()
export class VendorCheckReminderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VendorCheckReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

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
    this.timer = setInterval(() => void this.run(), 60 * 60_000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    if (this.running) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.prisma.vendorCheckAssignment.findMany({
        where: {
          status: { in: ["ASSIGNED", "IN_PROGRESS", "RETURNED"] },
          dueAt: { lt: now },
          OR: [
            { lastRemindedAt: null },
            {
              lastRemindedAt: {
                lt: new Date(now.getTime() - VENDOR_REMINDER_EVERY_MS),
              },
            },
          ],
        },
        take: 300,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          vendorUserId: true,
          handlerUserId: true,
          assignedById: true,
          lastRemindedAt: true,
          dueAt: true,
          check: { select: { type: true } },
          case: { select: { publicId: true, caseNumber: true } },
          vendor: { select: { displayName: true } },
        },
      });
      for (const job of due) {
        const done = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.vendorCheckAssignment.updateMany({
            where: { id: job.id, lastRemindedAt: job.lastRemindedAt },
            data: { lastRemindedAt: now },
          });
          if (claimed.count !== 1) return false;
          const check = job.check.type.replaceAll("_", " ").toLowerCase();
          await tx.notification.createMany({
            data: [
              {
                tenantId: job.tenantId,
                userId: job.handlerUserId ?? job.vendorUserId,
                type: "VENDOR_CHECK_OVERDUE",
                title: `Overdue: ${job.case.caseNumber}`,
                body: `The ${check} check was due ${job.dueAt!.toISOString().slice(0, 10)}. Submit it or tell us why it is late.`,
                href: "/vendor/checks",
              },
              {
                tenantId: job.tenantId,
                userId: job.assignedById,
                type: "VENDOR_CHECK_OVERDUE",
                title: `Vendor late: ${job.case.caseNumber}`,
                body: `${job.vendor.displayName} has not finished the ${check} check (due ${job.dueAt!.toISOString().slice(0, 10)}).`,
                href: "/operations/vendor-work",
              },
            ],
          });
          await tx.auditEvent.create({
            data: {
              tenantId: job.tenantId,
              action: "vendor_check.overdue-reminder",
              resourceType: "case",
              resourcePublicId: job.case.publicId,
              afterJson: JSON.stringify({
                assignmentId: job.publicId,
                dueAt: job.dueAt,
              }),
            },
          });
          return true;
        });
        if (done) sent += 1;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Vendor reminder scan failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
