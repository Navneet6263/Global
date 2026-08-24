import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../common/auth/actor";
import { SecretBoxService } from "../common/security/secret-box.service";
import { PrismaService } from "../database/prisma.service";
import { LocalObjectStorageService } from "../documents/local-object-storage.service";
import { ReportsService } from "../reports/reports.service";

type ConsentDelivery = {
  channel: "SMS" | "EMAIL";
  destination: string | null;
  otp: string;
  consentUrl: string;
  expiresAt: string;
};

const NOOP_TOPICS = new Set([
  "case.created",
  "case.status.changed",
  "consent.accepted",
  "clarification.responded",
  "verification.check.completed",
  "verification.case.ready-for-qa",
]);

@Injectable()
export class OutboxWorkerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly storage: LocalObjectStorageService,
    private readonly secretBox: SecretBoxService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.get<boolean>("OUTBOX_WORKER_ENABLED", true)) {
      this.logger.log("Outbox worker is disabled for this process");
      return;
    }
    const interval = this.config.get<number>("OUTBOX_POLL_INTERVAL_MS", 5000);
    this.timer = setInterval(() => void this.poll(), interval);
    this.timer.unref();
    void this.recoverAbandonedClaims().then(() => this.poll());
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    if (this.running) return;
    this.running = true;
    try {
      for (let processed = 0; processed < 10; processed += 1) {
        const event = await this.claim();
        if (!event) break;
        await this.process(event);
      }
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : "Outbox polling failed",
      );
    } finally {
      this.running = false;
    }
  }

  private async claim() {
    const candidate = await this.prisma.outboxEvent.findFirst({
      where: {
        status: { in: ["PENDING", "RETRY"] },
        availableAt: { lte: new Date() },
      },
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    return claimed.count === 1
      ? { ...candidate, attempts: candidate.attempts + 1 }
      : null;
  }

  private async process(
    event: Awaited<ReturnType<OutboxWorkerService["claim"]>>,
  ) {
    if (!event) return;
    try {
      const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
      if (event.topic === "report.generate.requested") {
        const caseId = this.requiredString(payload, "caseId");
        const actorUserId = this.optionalString(payload, "actorUserId");
        const actor = actorUserId
          ? await this.actor(actorUserId)
          : await this.fallbackReportActor(event.tenantId);
        await this.reports.generate(actor, caseId);
      } else if (event.topic === "consent.otp.requested") {
        const secret = this.requiredString(payload, "secret");
        await this.deliverConsent(
          this.secretBox.open<ConsentDelivery>(secret),
          event.id.toString(),
        );
      } else if (event.topic === "object.delete.requested") {
        await this.storage.delete(this.requiredString(payload, "objectKey"));
      } else if (!NOOP_TOPICS.has(event.topic)) {
        throw new Error(`Unsupported outbox topic: ${event.topic}`);
      }
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch (error) {
      const failed = event.attempts >= 10;
      const delayMs = Math.min(
        15 * 60_000,
        5000 * 2 ** Math.min(event.attempts, 8),
      );
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: failed ? "FAILED" : "RETRY",
          availableAt: new Date(Date.now() + delayMs),
        },
      });
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
    const webhook = this.config.get<string>("NOTIFICATION_WEBHOOK_URL");
    if (!webhook) throw new Error("NOTIFICATION_WEBHOOK_URL is not configured");
    const response = await fetch(webhook, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `sapling-outbox-${idempotencyKey}`,
      },
      body: JSON.stringify({
        channel: delivery.channel,
        destination: delivery.destination,
        template: "candidate-consent-otp",
        variables: {
          otp: delivery.otp,
          consentUrl: delivery.consentUrl,
          expiresAt: delivery.expiresAt,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Notification provider returned HTTP ${response.status}`);
  }

  private async actor(userPublicId: string): Promise<Actor> {
    const user = await this.prisma.user.findFirst({
      where: { publicId: userPublicId, status: "ACTIVE" },
      include: {
        tenant: true,
        client: true,
        userRoles: { include: { role: true } },
      },
    });
    if (!user) throw new Error("Outbox actor is unavailable");
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

  private async fallbackReportActor(tenantId: bigint): Promise<Actor> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
        userRoles: {
          some: {
            role: {
              code: { in: ["PLATFORM_ADMIN", "QA_REVIEWER", "OPS_MANAGER"] },
            },
          },
        },
      },
      select: { publicId: true },
      orderBy: { id: "asc" },
    });
    if (!user)
      throw new Error("No active report-generation actor is available");
    return this.actor(user.publicId);
  }

  private async recoverAbandonedClaims() {
    const recovered = await this.prisma.outboxEvent.updateMany({
      where: {
        status: "PROCESSING",
        availableAt: { lt: new Date(Date.now() - 15 * 60_000) },
      },
      data: { status: "RETRY", availableAt: new Date() },
    });
    if (recovered.count) {
      this.logger.warn(
        `Recovered ${recovered.count} abandoned outbox event(s)`,
      );
    }
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
