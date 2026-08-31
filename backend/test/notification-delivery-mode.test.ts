import assert from "node:assert/strict";
import test from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { RuntimeHealthService } from "../src/health/runtime-health.service";
import type { ReportsService } from "../src/reports/reports.service";
import type { ReportRecoveryService } from "../src/reports/report-recovery.service";
import type { ObjectDeletionRecoveryService } from "../src/outbox/object-deletion-recovery.service";
import type { OutboxClaimService } from "../src/outbox/outbox-claim.service";
import { OutboxWorkerService } from "../src/outbox/outbox-worker.service";

type WebhookDelivery = (
  payload: object,
  idempotencyKey: string,
) => Promise<void>;

function worker(environment: "development" | "production") {
  const config = {
    get: (key: string, fallback?: unknown) =>
      key === "NODE_ENV" ? environment : fallback,
  } as ConfigService;
  return new OutboxWorkerService(
    {} as PrismaService,
    {} as ReportsService,
    {} as LocalObjectStorageService,
    {} as SecretBoxService,
    config,
    {} as OutboxClaimService,
    {} as ReportRecoveryService,
    {} as ObjectDeletionRecoveryService,
    new RuntimeHealthService(),
  );
}

function deliver(workerService: OutboxWorkerService): WebhookDelivery {
  return (
    workerService as unknown as { deliverWebhook: WebhookDelivery }
  ).deliverWebhook.bind(workerService);
}

void test("local notification events are acknowledged when no provider is configured", async () => {
  await assert.doesNotReject(
    deliver(worker("development"))({ template: "test" }, "event-1"),
  );
});

void test("production notification delivery fails closed without a provider", async () => {
  await assert.rejects(
    deliver(worker("production"))({ template: "test" }, "event-1"),
    /NOTIFICATION_WEBHOOK_URL is not configured/,
  );
});
