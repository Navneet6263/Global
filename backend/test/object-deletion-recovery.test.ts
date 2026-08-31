import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { RuntimeHealthService } from "../src/health/runtime-health.service";
import { DataHousekeepingService } from "../src/outbox/data-housekeeping.service";
import { ObjectDeletionRecoveryService } from "../src/outbox/object-deletion-recovery.service";
import type {
  ClaimedOutboxEvent,
  OutboxClaimService,
} from "../src/outbox/outbox-claim.service";
import { OutboxWorkerService } from "../src/outbox/outbox-worker.service";
import type { ReportRecoveryService } from "../src/reports/report-recovery.service";
import type { ReportsService } from "../src/reports/reports.service";

const payloadJson = JSON.stringify({ objectKey: "tenant/evidence/original.pdf" });

function actor(): Actor {
  return {
    userId: 7n,
    userPublicId: "admin-user",
    tenantId: 2n,
    tenantPublicId: "tenant-public",
    tenantName: "Sapling Global",
    email: "admin@sapling.test",
    displayName: "Admin",
    mustChangePassword: false,
    roles: ["PLATFORM_ADMIN"],
    permissions: ["*"],
  };
}

function claimedEvent(): ClaimedOutboxEvent {
  return {
    id: 41n,
    tenantId: 2n,
    topic: "object.delete.requested",
    aggregateType: "field_visit",
    aggregateId: "visit-public-id",
    payloadJson,
    status: "PROCESSING",
    attempts: 10,
    availableAt: new Date(0),
    claimedAt: new Date(),
    claimToken: "00000000-0000-4000-8000-000000000041",
    processedAt: null,
    createdAt: new Date(0),
  };
}

void test("terminal object deletion failure is durable, audited and alerted", async () => {
  const state = claimedEvent();
  let audit: { data: Record<string, unknown> } | undefined;
  let notifications = 0;
  const tx = {
    outboxEvent: {
      updateMany: ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (
          state.status !== where.status ||
          state.claimToken !== where.claimToken ||
          state.topic !== where.topic
        ) {
          return Promise.resolve({ count: 0 });
        }
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      },
    },
    user: { findMany: () => Promise.resolve([{ id: 7n }]) },
    notification: {
      createMany: ({ data }: { data: unknown[] }) => {
        notifications += data.length;
        return Promise.resolve({ count: data.length });
      },
    },
    auditEvent: {
      create: (value: { data: Record<string, unknown> }) => {
        audit = value;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;

  const recorded = await new ObjectDeletionRecoveryService(prisma).failTerminal(
    claimedEvent(),
    new Error("storage provider unavailable"),
  );

  assert.equal(recorded, true);
  assert.equal(state.status, "FAILED");
  assert.equal(state.payloadJson, payloadJson);
  assert.equal(state.claimToken, null);
  assert.ok(state.processedAt instanceof Date);
  assert.equal(notifications, 1);
  assert.equal(audit?.data.action, "object.deletion-failed");
  assert.match(String(audit?.data.afterJson), /"payloadPreserved":true/);
});

void test("platform admin can atomically requeue a failed deletion without losing its key", async () => {
  const state = { ...claimedEvent(), status: "FAILED", processedAt: new Date() };
  let auditAction: unknown;
  const tx = {
    outboxEvent: {
      findFirst: () => Promise.resolve({ ...state }),
      updateMany: ({ data }: { data: Record<string, unknown> }) => {
        if (state.status !== "FAILED") return Promise.resolve({ count: 0 });
        assert.equal(Object.hasOwn(data, "payloadJson"), false);
        Object.assign(state, data);
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        auditAction = data.action;
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;

  const result = await new ObjectDeletionRecoveryService(prisma).requeue(actor(), "41");

  assert.deepEqual(result, { id: "41", status: "RETRY" });
  assert.equal(state.status, "RETRY");
  assert.equal(state.attempts, 0);
  assert.equal(state.processedAt, null);
  assert.equal(state.payloadJson, payloadJson);
  assert.equal(auditAction, "object.deletion-requeued");
});

void test("worker delegates the tenth deletion failure to durable recovery", async () => {
  let terminalCalls = 0;
  let genericFailureCalls = 0;
  const storage = {
    delete: () => Promise.reject(new Error("provider unavailable")),
  } as unknown as LocalObjectStorageService;
  const claims = {
    fail: () => {
      genericFailureCalls += 1;
      return Promise.resolve();
    },
  } as unknown as OutboxClaimService;
  const recovery = {
    failTerminal: () => {
      terminalCalls += 1;
      return Promise.resolve(true);
    },
  } as unknown as ObjectDeletionRecoveryService;
  const cfg = { get: (_key: string, fallback: unknown) => fallback } as ConfigService;
  const worker = new OutboxWorkerService(
    {} as PrismaService,
    {} as ReportsService,
    storage,
    {} as SecretBoxService,
    cfg,
    claims,
    {} as ReportRecoveryService,
    recovery,
    new RuntimeHealthService(),
  );

  await (
    worker as unknown as { process(event: ReturnType<typeof claimedEvent>): Promise<void> }
  ).process(claimedEvent());

  assert.equal(terminalCalls, 1);
  assert.equal(genericFailureCalls, 0);
});

void test("housekeeping never purges unresolved object deletion failures", async () => {
  let outboxWhere: Record<string, unknown> | undefined;
  const prisma = {
    refreshSession: { deleteMany: () => Promise.resolve({ count: 0 }) },
    candidatePortalAccess: { deleteMany: () => Promise.resolve({ count: 0 }) },
    outboxEvent: {
      deleteMany: ({ where }: { where: Record<string, unknown> }) => {
        outboxWhere = where;
        return Promise.resolve({ count: 0 });
      },
    },
  } as unknown as PrismaService;

  await new DataHousekeepingService(prisma).run();

  assert.deepEqual(outboxWhere?.OR, [
    { status: "PROCESSED" },
    { status: "FAILED", topic: { not: "object.delete.requested" } },
  ]);
});
