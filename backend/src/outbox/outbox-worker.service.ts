import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailerService } from "../common/mail/mailer.service";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { RuntimeHealthService } from "../health/runtime-health.service";
import { ReportRecoveryService } from "../reports/report-recovery.service";
import { ReportsService } from "../reports/reports.service";
import { ObjectDeletionRecoveryService } from "./object-deletion-recovery.service";
import {
  OutboxClaimService,
  type ClaimedOutboxEvent,
} from "./outbox-claim.service";
import {
  deliverCandidateAccessMessage,
  deliverConsentMessage,
  deliverDirectEmail,
  deliverExecutiveBrief,
  deliverWebhookMessage,
  isCurrentCandidateAccessDelivery,
  isCurrentConsentOtpDelivery,
  type WebhookState,
} from "./outbox-delivery.helpers";
import {
  NOOP_TOPICS,
  type CandidateAccessDelivery,
  type ConsentDelivery,
  type EmailDelivery,
  type ExecutiveDelivery,
} from "./outbox-worker.types";

const SENSITIVE_TOPICS = new Set([
  "notification.requested",
  "consent.otp.requested",
  "dashboard.executive.delivery",
  "candidate.access.issued",
  "email.requested",
]);

@Injectable()
export class OutboxWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private readonly webhookState: WebhookState = { suppressedLogged: false };
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly storage: LocalObjectStorageService,
    private readonly secretBox: SecretBoxService,
    private readonly config: ConfigService,
    private readonly claims: OutboxClaimService,
    private readonly reportRecovery: ReportRecoveryService,
    private readonly deletionRecovery: ObjectDeletionRecoveryService,
    private readonly health: RuntimeHealthService,
    private readonly mailer: MailerService,
  ) {}

  onApplicationBootstrap() {
    const processRole = this.config.get<string>("PROCESS_ROLE", "all");
    if (!["all", "worker"].includes(processRole)) {
      this.logger.log(`Outbox worker skipped for ${processRole} process`);
      return;
    }
    if (!this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true)) {
      this.logger.log("Outbox worker is disabled for this process");
      return;
    }
    const interval = this.config.get<number>("OUTBOX_POLL_INTERVAL_MS", 5000);
    this.health.register("outbox", interval * 3 + 60_000);
    this.timer = setInterval(() => void this.poll(), interval);
    this.timer.unref();
    void this.claims.recoverAbandoned().then((count) => {
      if (count) {
        this.logger.warn(`Recovered ${count} abandoned outbox event(s)`);
      }
      return this.poll();
    });
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      for (let processed = 0; processed < 10; processed += 1) {
        const event = await this.claims.claim();
        if (!event) break;
        await this.process(event);
      }
      this.health.success("outbox");
    } catch (error) {
      this.health.failure("outbox", error);
      this.logger.error(
        error instanceof Error ? error.message : "Outbox polling failed",
      );
    } finally {
      this.running = false;
    }
  }

  private async process(event: ClaimedOutboxEvent) {
    try {
      await this.dispatch(event);
      const sensitive = SENSITIVE_TOPICS.has(event.topic);
      if (!(await this.claims.complete(event, sensitive))) {
        this.logger.warn(
          `Outbox event ${event.id.toString()} completed after its processing lease expired`,
        );
      }
    } catch (error) {
      await this.handleFailure(event, error);
    }
  }

  private async dispatch(event: ClaimedOutboxEvent) {
    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    const sendWebhook = (body: object, key: string) =>
      this.deliverWebhook(body, key);
    if (event.topic === "report.generate.requested") {
      const caseId = this.requiredString(payload, "caseId");
      const reportId =
        this.optionalString(payload, "reportId") ?? event.aggregateId;
      await this.reports.generateRequested(event.tenantId, caseId, reportId);
    } else if (event.topic === "notification.requested") {
      await this.deliverWebhook(
        this.secretBox.open<object>(this.requiredString(payload, "secret")),
        `sapling-notification-${event.id.toString()}`,
      );
    } else if (event.topic === "consent.otp.requested") {
      const delivery = this.secretBox.open<ConsentDelivery>(
        this.requiredString(payload, "secret"),
      );
      if (await isCurrentConsentOtpDelivery(this.prisma, event, delivery)) {
        await deliverConsentMessage(
          this.mailer,
          sendWebhook,
          delivery,
          event.id.toString(),
        );
      }
    } else if (event.topic === "email.requested") {
      await deliverDirectEmail(
        this.config,
        this.mailer,
        this.storage,
        this.logger,
        this.secretBox.open<EmailDelivery>(
          this.requiredString(payload, "secret"),
        ),
      );
    } else if (event.topic === "object.delete.requested") {
      await this.deleteObjectSafely(event, payload);
    } else if (event.topic === "dashboard.executive.delivery") {
      await deliverExecutiveBrief(
        sendWebhook,
        this.secretBox.open<ExecutiveDelivery>(
          this.requiredString(payload, "secret"),
        ),
        event.id.toString(),
      );
    } else if (event.topic === "candidate.access.issued") {
      const delivery = this.secretBox.open<CandidateAccessDelivery>(
        this.requiredString(payload, "secret"),
      );
      if (
        await isCurrentCandidateAccessDelivery(this.prisma, event, delivery)
      ) {
        await deliverCandidateAccessMessage(
          this.mailer,
          sendWebhook,
          delivery,
          event.id.toString(),
        );
      }
    } else if (!NOOP_TOPICS.has(event.topic)) {
      throw new Error(`Unsupported outbox topic: ${event.topic}`);
    }
  }

  private async deleteObjectSafely(
    event: ClaimedOutboxEvent,
    payload: Record<string, unknown>,
  ) {
    const objectKey = this.requiredString(payload, "objectKey");
    if (
      event.aggregateType === "document_upload_lease" &&
      typeof this.prisma?.documentVersion?.findFirst === "function"
    ) {
      const referenced = await this.prisma.documentVersion.findFirst({
        where: { objectKey },
        select: { id: true },
      });
      if (referenced) {
        this.logger.warn(
          `Skipped object deletion lease ${event.id.toString()} because objectKey is referenced`,
        );
        return;
      }
    }
    await this.storage.delete(objectKey);
  }

  private async handleFailure(event: ClaimedOutboxEvent, error: unknown) {
    // An email that fails twice is stopped (marked FAILED) instead of retrying for hours;
    // other jobs keep ten attempts.
    const failed =
      event.attempts >= (event.topic === "email.requested" ? 2 : 10);
    const delayMs = Math.min(
      15 * 60_000,
      5000 * 2 ** Math.min(event.attempts, 8),
    );
    if (failed && event.topic === "report.generate.requested") {
      await this.reportRecovery.markFailed(
        event.tenantId,
        event.aggregateId,
        error,
      );
    }
    if (failed && event.topic === "object.delete.requested") {
      const recorded = await this.deletionRecovery.failTerminal(event, error);
      if (!recorded) {
        this.logger.warn(
          `Object deletion event ${event.id.toString()} lost its processing lease before terminal failure was recorded`,
        );
      }
    } else {
      await this.claims.fail(
        event,
        failed,
        new Date(Date.now() + delayMs),
        failed && SENSITIVE_TOPICS.has(event.topic),
      );
    }
    this.logger.error(
      `Outbox event ${event.id.toString()} (${event.topic}) failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  private deliverWebhook(payload: object, idempotencyKey: string) {
    return deliverWebhookMessage(
      this.config,
      this.logger,
      this.webhookState,
      payload,
      idempotencyKey,
    );
  }

  private requiredString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (typeof value !== "string" || !value) {
      throw new Error(`Outbox payload is missing ${key}`);
    }
    return value;
  }

  private optionalString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    return typeof value === "string" && value ? value : undefined;
  }
}
