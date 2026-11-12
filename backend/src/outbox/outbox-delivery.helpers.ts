import type { Logger } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import type { MailerService } from "../common/mail/mailer.service";
import type { PrismaService } from "../database/prisma.service";
import type { LocalObjectStorageService } from "../documents/local-object-storage.service";
import type { ClaimedOutboxEvent } from "./outbox-claim.service";
import type {
  CandidateAccessDelivery,
  ConsentDelivery,
  EmailDelivery,
  ExecutiveDelivery,
} from "./outbox-worker.types";

export interface WebhookState {
  suppressedLogged: boolean;
}

export async function deliverWebhookMessage(
  config: ConfigService,
  logger: Logger,
  state: WebhookState,
  payload: object,
  idempotencyKey: string,
): Promise<void> {
  const webhook = config.get<string>("NOTIFICATION_WEBHOOK_URL");
  if (!webhook) {
    const environment = config.get<string>("NODE_ENV", "development");
    if (environment === "production") {
      throw new Error("NOTIFICATION_WEBHOOK_URL is not configured");
    }
    if (!state.suppressedLogged) {
      logger.warn(
        "Notification delivery is disabled in this non-production environment; queued notification events will be safely acknowledged",
      );
      state.suppressedLogged = true;
    }
    return;
  }
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const secret = config.get<string>("NOTIFICATION_WEBHOOK_SECRET");
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
  if (!response.ok) {
    throw new Error(`Notification provider returned HTTP ${response.status}`);
  }
}

export async function deliverConsentMessage(
  mailer: MailerService,
  sendWebhook: (payload: object, key: string) => Promise<void>,
  delivery: ConsentDelivery,
  idempotencyKey: string,
): Promise<void> {
  if (!delivery.destination) {
    throw new Error("Candidate email or phone is required for OTP delivery");
  }
  if (delivery.channel === "EMAIL" && mailer.configured()) {
    await mailer.sendTemplate(delivery.destination, "consent-otp", {
      otp: delivery.otp,
      consentUrl: delivery.consentUrl,
      expiresAt: delivery.expiresAt,
    });
    return;
  }
  await sendWebhook(
    {
      channel: delivery.channel,
      destination: delivery.destination,
      template: "candidate-consent-otp",
      variables: {
        otp: delivery.otp,
        ...(delivery.consentUrl ? { consentUrl: delivery.consentUrl } : {}),
        expiresAt: delivery.expiresAt,
      },
    },
    `sapling-outbox-${idempotencyKey}`,
  );
}

export async function deliverCandidateAccessMessage(
  mailer: MailerService,
  sendWebhook: (payload: object, key: string) => Promise<void>,
  delivery: CandidateAccessDelivery,
  idempotencyKey: string,
): Promise<void> {
  if (delivery.channel === "EMAIL" && mailer.configured()) {
    await mailer.sendTemplate(delivery.destination, "candidate-access", {
      portalUrl: delivery.portalUrl,
      expiresAt: delivery.expiresAt,
      reason: delivery.reason,
    });
    return;
  }
  await sendWebhook(
    {
      channel: delivery.channel,
      destination: delivery.destination,
      template: "candidate-document-upload-link",
      variables: {
        portalUrl: delivery.portalUrl,
        expiresAt: delivery.expiresAt,
        ...(delivery.reason ? { reason: delivery.reason } : {}),
      },
    },
    `sapling-candidate-access-${idempotencyKey}`,
  );
}

export async function isCurrentCandidateAccessDelivery(
  prisma: PrismaService,
  event: ClaimedOutboxEvent,
  delivery: CandidateAccessDelivery,
): Promise<boolean> {
  const access = await prisma.candidatePortalAccess.findFirst({
    where: {
      publicId: delivery.accessId,
      tenantId: event.tenantId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (access) return true;
  await prisma.auditEvent.create({
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

export async function isCurrentConsentOtpDelivery(
  prisma: PrismaService,
  event: ClaimedOutboxEvent,
  delivery: ConsentDelivery,
): Promise<boolean> {
  const consent = await prisma.consent.findFirst({
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
    await prisma.auditEvent.create({
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

export async function deliverExecutiveBrief(
  sendWebhook: (payload: object, key: string) => Promise<void>,
  delivery: ExecutiveDelivery,
  idempotencyKey: string,
): Promise<void> {
  await sendWebhook(
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

export async function deliverDirectEmail(
  config: ConfigService,
  mailer: MailerService,
  storage: LocalObjectStorageService,
  logger: Logger,
  delivery: EmailDelivery,
): Promise<void> {
  if (mailer.configured()) {
    const attachments = await Promise.all(
      (delivery.attachments ?? []).map(async (file) => ({
        filename: file.filename,
        contentType: file.contentType,
        content: file.objectKey
          ? await storage.get(file.objectKey)
          : Buffer.from(file.base64 ?? "", "base64"),
      })),
    );
    await mailer.sendTemplate(
      delivery.to,
      delivery.template,
      delivery.variables,
      { cc: delivery.cc, attachments },
    );
    return;
  }
  if (config.get<string>("NODE_ENV", "development") === "production") {
    throw new Error("SMTP_HOST is not configured");
  }
  logger.warn(
    `SMTP is not configured; email "${delivery.template}" for ${delivery.to} not sent${
      typeof delivery.variables.otp === "string"
        ? ` (development code: ${delivery.variables.otp})`
        : ""
    }`,
  );
}
