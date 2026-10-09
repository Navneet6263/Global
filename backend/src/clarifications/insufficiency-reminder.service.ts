import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { sendInsufficiencyNotice } from "./insufficiency-notice";

export const REMINDER_EVERY_MS = 24 * 3_600_000;
export const MAX_REMINDERS = 7;

/**
 * BGV process: an L1 / L2 insufficiency still open after 24 hours is re-alerted to the
 * candidate and the company admin, once every 24 hours (at most 7 times). Each
 * reminder is recorded in the audit trail, which is also what spaces them out.
 */
@Injectable()
export class InsufficiencyReminderService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InsufficiencyReminderService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly secretBox?: SecretBoxService,
    @Optional() private readonly pii?: SubjectPiiService,
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
    const webOrigin = this.config.get<string>("WEB_ORIGIN");
    if (this.running || !this.secretBox || !this.pii || !webOrigin) return 0;
    this.running = true;
    let sent = 0;
    try {
      const open = await this.prisma.clarification.findMany({
        where: {
          level: { in: ["L1", "L2"] },
          status: "OPEN",
          createdAt: { lte: new Date(now.getTime() - REMINDER_EVERY_MS) },
          case: {
            status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"] },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          caseId: true,
          subject: true,
          level: true,
          createdAt: true,
          messages: {
            where: { senderType: "TEAM" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { body: true },
          },
        },
      });
      for (const item of open) {
        const done = await this.prisma.$transaction(async (tx) => {
          const previous = await tx.auditEvent.findMany({
            where: {
              tenantId: item.tenantId,
              action: "clarification.insufficiency-reminder",
              resourcePublicId: item.publicId,
            },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
          });
          const last = previous[0]?.createdAt ?? item.createdAt;
          if (
            previous.length >= MAX_REMINDERS ||
            now.getTime() - last.getTime() < REMINDER_EVERY_MS
          )
            return false;
          const reminder = previous.length + 1;
          const notice = await sendInsufficiencyNotice(
            tx,
            { secretBox: this.secretBox!, pii: this.pii!, webOrigin },
            {
              tenantId: item.tenantId,
              caseId: item.caseId,
              subject: item.subject,
              message: item.messages[0]?.body ?? "",
              reminder,
              level: item.level === "L2" ? "L2" : "L1",
            },
          );
          await tx.auditEvent.create({
            data: {
              tenantId: item.tenantId,
              action: "clarification.insufficiency-reminder",
              resourceType: "clarification",
              resourcePublicId: item.publicId,
              afterJson: JSON.stringify({ reminder, ...notice }),
            },
          });
          return true;
        });
        if (done) sent += 1;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "Insufficiency reminder scan failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
