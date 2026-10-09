import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { queueEmail } from "../common/mail/queue-email";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import {
  MIS_TITLES,
  misCsv,
  misRows,
  misWindow,
  nextMisRun,
  type MisFrequency,
  type MisPreset,
} from "./client-mis";
import { misCases } from "./client-reports.service";

/** Emails each due client MIS (CSV attached) and schedules the next run. */
@Injectable()
export class ClientMisScheduleService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ClientMisScheduleService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly secretBox?: SecretBoxService,
  ) {}

  onApplicationBootstrap() {
    if (
      !this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true) ||
      !["all", "worker"].includes(
        this.config.get<string>("PROCESS_ROLE", "all"),
      )
    )
      return;
    this.timer = setInterval(() => void this.run(), 30 * 60_000);
    this.timer.unref();
    void this.run();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    if (this.running || !this.secretBox) return 0;
    this.running = true;
    let sent = 0;
    try {
      const due = await this.prisma.clientMisSchedule.findMany({
        where: { active: true, nextRunAt: { lte: now } },
        orderBy: { nextRunAt: "asc" },
        take: 100,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          clientId: true,
          preset: true,
          frequency: true,
          recipientsJson: true,
          nextRunAt: true,
          client: { select: { displayName: true, status: true } },
        },
      });
      const webOrigin = this.config.get<string>("WEB_ORIGIN") ?? "";
      for (const schedule of due) {
        const preset = schedule.preset as MisPreset;
        const frequency = schedule.frequency as MisFrequency;
        const window = misWindow(frequency, now);
        const cases = await misCases(this.prisma, {
          tenantId: schedule.tenantId,
          clientId: schedule.clientId,
          ...window,
        });
        const rows = misRows(preset, cases, now);
        // Only people who are still active users of the company get the MIS.
        const recipients = await this.prisma.user.findMany({
          where: {
            tenantId: schedule.tenantId,
            clientId: schedule.clientId,
            status: "ACTIVE",
            email: { in: JSON.parse(schedule.recipientsJson) as string[] },
          },
          select: { email: true },
        });
        const done = await this.prisma.$transaction(async (tx) => {
          const claimed = await tx.clientMisSchedule.updateMany({
            where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
            data: { lastRunAt: now, nextRunAt: nextMisRun(frequency, now) },
          });
          if (claimed.count !== 1) return false;
          if (schedule.client.status !== "ACTIVE") return false;
          const csv = Buffer.from(misCsv(preset, rows)).toString("base64");
          for (const person of recipients)
            await queueEmail(tx, this.secretBox!, {
              tenantId: schedule.tenantId,
              aggregateType: "client_mis",
              aggregateId: schedule.publicId,
              to: person.email,
              template: "client-mis",
              attachments: [
                {
                  filename: `Sapling-Global-${preset.toLowerCase()}-mis.csv`,
                  contentType: "text/csv",
                  base64: csv,
                },
              ],
              variables: {
                title: MIS_TITLES[preset],
                frequency: frequency.toLowerCase(),
                companyName: schedule.client.displayName,
                rows: rows.length,
                url: `${webOrigin}/client-portal/reports?view=mis`,
              },
            });
          await tx.auditEvent.create({
            data: {
              tenantId: schedule.tenantId,
              action: "client.mis-delivered",
              resourceType: "client_mis",
              resourcePublicId: schedule.publicId,
              afterJson: JSON.stringify({
                preset,
                frequency,
                rows: rows.length,
                recipients: recipients.length,
              }),
            },
          });
          return true;
        });
        if (done) sent += 1;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Client MIS run failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
