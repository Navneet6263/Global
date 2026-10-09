import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import {
  ANNEXURE_AGEING_MS,
  BillingAnnexureService,
} from "./billing-annexure.service";

const ALERT_EVERY_MS = 24 * 3_600_000;
export const MAX_AGEING_ALERTS = 7;

/**
 * Bill validation ageing (BGV process): an annexure not validated 3 days after it was
 * sent alerts the company admins and Finance, once a day (at most 7 times, audited).
 */
@Injectable()
export class BillingAnnexureAgeingService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(BillingAnnexureAgeingService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly annexure: BillingAnnexureService,
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
      const ageing = await this.prisma.invoice.findMany({
        where: {
          annexureStatus: "PENDING",
          annexureSentAt: {
            lte: new Date(now.getTime() - ANNEXURE_AGEING_MS),
          },
          status: { notIn: ["DRAFT", "CANCELLED"] },
        },
        take: 200,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          clientId: true,
          invoiceNumber: true,
          annexureSentAt: true,
          client: { select: { displayName: true } },
        },
      });
      for (const invoice of ageing) {
        const sentAt = invoice.annexureSentAt!;
        const done = await this.prisma.$transaction(async (tx) => {
          const previous = await tx.auditEvent.findMany({
            where: {
              tenantId: invoice.tenantId,
              action: "finance.annexure-ageing-alert",
              resourcePublicId: invoice.publicId,
              createdAt: { gte: sentAt },
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });
          if (
            previous.length >= MAX_AGEING_ALERTS ||
            (previous[0] &&
              now.getTime() - previous[0].createdAt.getTime() < ALERT_EVERY_MS)
          )
            return false;
          const days = Math.floor(
            (now.getTime() - sentAt.getTime()) / 86_400_000,
          );
          const clientAdmins = await this.annexure.notifyClient(
            tx,
            invoice.tenantId,
            invoice,
            "ageing",
          );
          const financeUsers = await this.annexure.notifyFinance(
            tx,
            invoice.tenantId,
            invoice,
            `${invoice.client.displayName} has not validated bill ${invoice.invoiceNumber} for ${days} days.`,
          );
          await tx.auditEvent.create({
            data: {
              tenantId: invoice.tenantId,
              action: "finance.annexure-ageing-alert",
              resourceType: "invoice",
              resourcePublicId: invoice.publicId,
              afterJson: JSON.stringify({
                invoiceNumber: invoice.invoiceNumber,
                days,
                alert: previous.length + 1,
                clientAdmins,
                financeUsers,
              }),
            },
          });
          return true;
        });
        if (done) sent += 1;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Annexure ageing scan failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
