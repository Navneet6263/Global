import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { ReportsService } from "../reports/reports.service";
import { ReportRecoveryService } from "../reports/report-recovery.service";
import { RuntimeHealthService } from "../health/runtime-health.service";
import { ObjectDeletionRecoveryService } from "./object-deletion-recovery.service";
import {
  NOOP_TOPICS,
  type CandidateAccessDelivery,
  type ConsentDelivery,
  type ExecutiveDelivery,
} from "./outbox-worker.types";
import {
  OutboxClaimService,
  type ClaimedOutboxEvent,
} from "./outbox-claim.service";

@Injectable()
export class OutboxWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private notificationSuppressionLogged = false;

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
      if (count)
        this.logger.warn(`Recovered ${count} abandoned outbox event(s)`);
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
      const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
      if (event.topic === "report.generate.requested") {
        const caseId = this.requiredString(payload, "caseId");
        const reportId =
          this.optionalString(payload, "reportId") ?? event.aggregateId;
        const actorUserId = this.optionalString(payload, "actorUserId");
        const actor = await this.reportActor(event.tenantId, actorUserId);
        await this.reports.generateRequested(actor, caseId, reportId);
      } else if (event.topic === "consent.otp.requested") {
        const secret = this.requiredString(payload, "secret");
        const delivery = this.secretBox.open<ConsentDelivery>(secret);
        if (await this.isCurrentConsentOtp(event, delivery)) {
          await this.deliverConsent(delivery, event.id.toString());
        }
      } else if (event.topic === "object.delete.requested") {
        await this.storage.delete(this.requiredString(payload, "objectKey"));
      } else if (event.topic === "dashboard.executive.delivery") {
        const secret = this.requiredString(payload, "secret");
        await this.deliverExecutive(
          this.secretBox.open<ExecutiveDelivery>(secret),
          event.id.toString(),
        );
      } else if (event.topic === "candidate.access.issued") {
        const secret = this.requiredString(payload, "secret");
        const delivery = this.secretBox.open<CandidateAccessDelivery>(secret);
        if (await this.isCurrentCandidateAccess(event, delivery)) {
          await this.deliverCandidateAccess(delivery, event.id.toString());
        }
      } else if (!NOOP_TOPICS.has(event.topic)) {
        throw new Error(`Unsupported outbox topic: ${event.topic}`);
      }
      const sensitive = [
        "consent.otp.requested",
        "dashboard.executive.delivery",
        "candidate.access.issued",
      ].includes(event.topic);
      if (!(await this.claims.complete(event, sensitive))) {
        this.logger.warn(
          `Outbox event ${event.id.toString()} completed after its processing lease expired`,
        );
      }
    } catch (error) {
      const failed = event.attempts >= 10;
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
          failed &&
            [
              "consent.otp.requested",
              "dashboard.executive.delivery",
              "candidate.access.issued",
            ].includes(event.topic),
        );
      }
      this.logger.error(
        `Outbox event ${event.id.toString()} (${event.topic}) failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  private async deliverConsent(
    delivery: ConsentDelivery,
    idempotencyKey: string,
  ) {
    if (!delivery.destination)
      throw new Error("Candidate email or phone is required for OTP delivery");
    await this.deliverWebhook(
      {
        channel: delivery.channel,
        destination: delivery.destination,
        template: "candidate-consent-otp",
        variables: {
          otp: delivery.otp,
          consentUrl: delivery.consentUrl,
          expiresAt: delivery.expiresAt,
        },
      },
      `sapling-outbox-${idempotencyKey}`,
    );
  }

  private async deliverCandidateAccess(
    delivery: CandidateAccessDelivery,
    idempotencyKey: string,
  ) {
    await this.deliverWebhook(
      {
        channel: delivery.channel,
        destination: delivery.destination,
        template: "candidate-document-upload-link",
        variables: {
          portalUrl: delivery.portalUrl,
          expiresAt: delivery.expiresAt,
        },
      },
      `sapling-candidate-access-${idempotencyKey}`,
    );
  }

  private async isCurrentCandidateAccess(
    event: ClaimedOutboxEvent,
    delivery: CandidateAccessDelivery,
  ) {
    const access = await this.prisma.candidatePortalAccess.findFirst({
      where: {
        publicId: delivery.accessId,
        tenantId: event.tenantId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (access) return true;
    await this.prisma.auditEvent.create({
      data: {
        tenantId: event.tenantId,
        action: "candidate-portal.delivery-skipped",
        resourceType: "candidate-portal-access",
        resourcePublicId: delivery.accessId,
        afterJson: JSON.stringify({ reason: "expired-or-revoked" }),
      },
    });
    return false;
  }

  private async isCurrentConsentOtp(
    event: ClaimedOutboxEvent,
    delivery: ConsentDelivery,
  ) {
    const consent = await this.prisma.consent.findFirst({
      where: {
        publicId: event.aggregateId,
        case: { tenantId: event.tenantId },
      },
      select: { status: true, otpLastIssuedAt: true, otpExpiresAt: true },
    });
    const issuedAt = new Date(delivery.issuedAt);
    const current = Boolean(
      consent &&
      consent.status === "REQUESTED" &&
      consent.otpLastIssuedAt?.getTime() === issuedAt.getTime() &&
      consent.otpExpiresAt &&
      consent.otpExpiresAt > new Date() &&
      new Date(delivery.expiresAt) > new Date(),
    );
    if (!current) {
      await this.prisma.auditEvent.create({
        data: {
          tenantId: event.tenantId,
          action: "consent.otp-delivery-skipped",
          resourceType: "consent",
          resourcePublicId: event.aggregateId,
          afterJson: JSON.stringify({ reason: "expired-or-superseded" }),
        },
      });
    }
    return current;
  }

  private async deliverExecutive(
    delivery: ExecutiveDelivery,
    idempotencyKey: string,
  ) {
    await this.deliverWebhook(
      {
        channel: "EMAIL",
        destination: delivery.recipientEmail,
        template: "executive-portfolio-brief",
        variables: {
          format: delivery.format,
          dashboardUrl: delivery.dashboardUrl,
          exportUrl: delivery.exportUrl,
          scheduledFor: delivery.deliveryAt,
        },
      },
      `sapling-executive-${idempotencyKey}`,
    );
  }

  private async deliverWebhook(payload: object, idempotencyKey: string) {
    const webhook = this.config.get<string>("NOTIFICATION_WEBHOOK_URL");
    if (!webhook) {
      const environment = this.config.get<string>("NODE_ENV", "development");
      if (environment === "production") {
        throw new Error("NOTIFICATION_WEBHOOK_URL is not configured");
      }
      if (!this.notificationSuppressionLogged) {
        this.logger.warn(
          "Notification delivery is disabled in this non-production environment; queued notification events will be safely acknowledged",
        );
        this.notificationSuppressionLogged = true;
      }
      return;
    }
    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();
    const secret = this.config.get<string>("NOTIFICATION_WEBHOOK_SECRET");
    const signature = secret
      ? createHmac("sha256", secret)
          .update(`${timestamp}.${body}`)
          .digest("hex")
      : undefined;
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-sapling-timestamp": timestamp,
        ...(signature ? { "x-sapling-signature": `sha256=${signature}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Notification provider returned HTTP ${response.status}`);
  }

  private async actor(
    userPublicId: string,
    tenantId: bigint,
  ): Promise<Actor | null> {
    const user = await this.prisma.user.findFirst({
      where: { publicId: userPublicId, tenantId, status: "ACTIVE" },
      include: {
        tenant: true,
        branch: true,
        client: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) return null;
    const roles = user.userRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) => {
          try {
            return JSON.parse(role.permissionsJson) as string[];
          } catch {
            return [];
          }
        }),
      ),
    ];
    return {
      userId: user.id,
      userPublicId: user.publicId,
      tenantId: user.tenantId,
      tenantPublicId: user.tenant.publicId,
      tenantName: user.tenant.name,
      branchId: user.branchId ?? undefined,
      branchPublicId: user.branch?.publicId,
      branchName: user.branch?.name,
      clientId: user.clientId ?? undefined,
      clientPublicId: user.client?.publicId,
      clientName: user.client?.displayName,
      email: user.email,
      displayName: user.displayName,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
    };
  }

  private async reportActor(tenantId: bigint, userPublicId?: string) {
    const requested = userPublicId
      ? await this.actor(userPublicId, tenantId)
      : null;
    return requested ?? this.fallbackReportActor(tenantId);
  }

  private async fallbackReportActor(tenantId: bigint): Promise<Actor> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
      },
      select: { publicId: true },
      orderBy: { id: "asc" },
    });
    if (!user)
      throw new Error("No active report-generation actor is available");
    const actor = await this.actor(user.publicId, tenantId);
    if (!actor) throw new Error("Report-generation actor became unavailable");
    return actor;
  }

  private requiredString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    if (typeof value !== "string" || !value)
      throw new Error(`Outbox payload is missing ${key}`);
    return value;
  }

  private optionalString(payload: Record<string, unknown>, key: string) {
    const value = payload[key];
    return typeof value === "string" && value ? value : undefined;
  }
}
