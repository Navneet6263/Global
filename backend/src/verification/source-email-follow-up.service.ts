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
import { FOLLOW_UP_EVERY_MS, stopSourceEmails } from "./source-email.service";

/**
 * Sends the automatic follow-ups for employer / university emails (Employment 7,
 * Education 3, every 24 hours). Stops on its own once the source has responded: a
 * method response recorded after the email, verified details saved, or the check done.
 */
@Injectable()
export class SourceEmailFollowUpService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SourceEmailFollowUpService.name);
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
      const due = await this.prisma.sourceEmail.findMany({
        where: { stoppedAt: null, nextFollowUpAt: { lte: now } },
        orderBy: { nextFollowUpAt: "asc" },
        take: 200,
        select: {
          id: true,
          publicId: true,
          tenantId: true,
          toEmail: true,
          ccEmails: true,
          subject: true,
          body: true,
          attachmentsJson: true,
          maxFollowUps: true,
          followUpsSent: true,
          createdAt: true,
          check: {
            select: {
              publicId: true,
              status: true,
              verifiedAt: true,
              case: { select: { publicId: true, status: true } },
              methodRuns: {
                where: { status: "RESPONDED" },
                orderBy: { respondedAt: "desc" },
                take: 1,
                select: { respondedAt: true },
              },
            },
          },
        },
      });
      for (const email of due) {
        const done = await this.prisma.$transaction(async (tx) => {
          const check = email.check;
          const responded = check.methodRuns[0]?.respondedAt;
          const reason =
            check.status === "COMPLETED" ||
            ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"].includes(
              check.case.status,
            )
              ? "Check closed"
              : responded && responded >= email.createdAt
                ? "Source responded"
                : check.verifiedAt && check.verifiedAt >= email.createdAt
                  ? "Verified details recorded"
                  : email.followUpsSent >= email.maxFollowUps
                    ? "All follow-ups sent"
                    : null;
          if (reason) {
            await stopSourceEmails(
              tx,
              {
                tenantId: email.tenantId,
                where: { id: email.id },
                reason,
                casePublicId: check.case.publicId,
                checkId: check.publicId,
              },
              now,
            );
            return false;
          }
          const followUp = email.followUpsSent + 1;
          const changed = await tx.sourceEmail.updateMany({
            where: {
              id: email.id,
              stoppedAt: null,
              followUpsSent: email.followUpsSent,
            },
            data: {
              followUpsSent: followUp,
              lastSentAt: now,
              nextFollowUpAt:
                followUp < email.maxFollowUps
                  ? new Date(now.getTime() + FOLLOW_UP_EVERY_MS)
                  : null,
              ...(followUp >= email.maxFollowUps
                ? { stoppedAt: now, stopReason: "All follow-ups sent" }
                : {}),
            },
          });
          if (changed.count !== 1) return false;
          const subject = `Reminder ${followUp}: ${email.subject}`.slice(
            0,
            300,
          );
          await queueEmail(tx, this.secretBox!, {
            tenantId: email.tenantId,
            aggregateType: "check",
            aggregateId: check.publicId,
            to: email.toEmail,
            cc: email.ccEmails ? email.ccEmails.split(",") : [],
            attachments: JSON.parse(email.attachmentsJson) as Array<{
              objectKey: string;
              filename: string;
              contentType: string;
            }>,
            template: "source-verification",
            variables: {
              subject,
              body: `This is a gentle reminder (${followUp} of ${email.maxFollowUps}) about our verification request below.\n\n${email.body}`,
            },
          });
          await tx.auditEvent.create({
            data: {
              tenantId: email.tenantId,
              action: "verification.source-email-follow-up",
              resourceType: "case",
              resourcePublicId: check.case.publicId,
              afterJson: JSON.stringify({
                checkId: check.publicId,
                emailId: email.publicId,
                followUp,
                of: email.maxFollowUps,
              }),
            },
          });
          return true;
        });
        if (done) sent += 1;
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Source follow-up scan failed",
      );
    } finally {
      this.running = false;
    }
    return sent;
  }
}
