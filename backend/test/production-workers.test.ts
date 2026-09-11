import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import { OutboxClaimService } from "../src/outbox/outbox-claim.service";
import { RuntimeHealthService } from "../src/health/runtime-health.service";
import { ReportRecoveryService } from "../src/reports/report-recovery.service";
import { RetentionWorkerService } from "../src/outbox/retention-worker.service";
import { ConsentIssuanceService } from "../src/consents/consent-issuance.service";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { Actor } from "../src/common/auth/actor";

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: (key: string, fallback?: unknown) =>
      Object.hasOwn(values, key) ? values[key] : fallback,
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`${key} missing`);
      return value;
    },
  } as ConfigService;
}

void test("two outbox workers cannot claim the same event", async () => {
  const state = {
    id: 1n,
    tenantId: 2n,
    topic: "case.created",
    aggregateType: "case",
    aggregateId: "case-id",
    payloadJson: "{}",
    status: "PENDING",
    attempts: 0,
    availableAt: new Date(0),
    claimedAt: null,
    claimToken: null,
    processedAt: null,
    createdAt: new Date(0),
  };
  const prisma = {
    outboxEvent: {
      findFirst: () => Promise.resolve({ ...state }),
      updateMany: ({
        where,
        data,
      }: {
        where: { status: string };
        data: Record<string, unknown>;
      }) => {
        if (state.status !== where.status) return Promise.resolve({ count: 0 });
        Object.assign(state, data, {
          status: "PROCESSING",
          attempts: state.attempts + 1,
        });
        return Promise.resolve({ count: 1 });
      },
    },
  } as unknown as PrismaService;
  const claims = new OutboxClaimService(prisma);
  const results = await Promise.all([claims.claim(), claims.claim()]);
  assert.equal(results.filter(Boolean).length, 1);
});

void test("runtime readiness becomes unhealthy after a worker failure", () => {
  const health = new RuntimeHealthService();
  health.register("outbox", 60_000);
  health.register("retention", 60_000);
  health.success("outbox");
  health.success("retention");
  assert.equal(health.snapshot(true).healthy, true);
  health.failure("outbox", new Error("provider unavailable"));
  const failed = health.snapshot(true);
  assert.equal(failed.healthy, false);
  const failedOutbox = failed.workers["outbox"];
  assert.ok(failedOutbox);
  assert.equal("error" in failedOutbox, false);
  health.success("outbox");
  assert.equal(health.snapshot(true).healthy, true);
});

void test("consent resend retires pending delivery before enqueuing the new OTP", async () => {
  const writes: Array<{ kind: string; value: unknown }> = [];
  const tx = {
    consent: { updateMany: () => Promise.resolve({ count: 1 }) },
    consentEvent: { create: () => Promise.resolve({}) },
    outboxEvent: {
      updateMany: (value: unknown) => {
        writes.push({ kind: "retire", value });
        return Promise.resolve({ count: 1 });
      },
      create: (value: unknown) => {
        writes.push({ kind: "create", value });
        return Promise.resolve({});
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
  };
  const cfg = config({
    WEB_ORIGIN: "https://verify.sapling.example",
    JWT_REFRESH_SECRET: "refresh-secret-0123456789abcdef01234567",
    DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
    NODE_ENV: "test",
  });
  await new ConsentIssuanceService(cfg, new SecretBoxService(cfg)).issue(
    tx as never,
    {
      consentId: 1n,
      consentPublicId: "00000000-0000-4000-8000-000000000001",
      tenantId: 2n,
      casePublicId: "00000000-0000-4000-8000-000000000002",
      actorUserId: 3n,
      phone: "+919876543210",
    },
  );
  const retirement = writes[0]?.value as { data: { status: string } };
  assert.equal(writes[0]?.kind, "retire");
  assert.equal(retirement.data.status, "PROCESSED");
  assert.equal(writes[1]?.kind, "create");
});

void test("terminal report failure is visible and can be requeued atomically", async () => {
  const writes: string[] = [];
  const tx = {
    report: {
      updateMany: ({ data }: { data: { status: string } }) => {
        writes.push(`report:${data.status}`);
        return Promise.resolve({ count: 1 });
      },
    },
    user: { findMany: () => Promise.resolve([{ id: 9n }]) },
    notification: {
      createMany: () => (
        writes.push("notification"),
        Promise.resolve({ count: 1 })
      ),
    },
    auditEvent: { create: () => (writes.push("audit"), Promise.resolve({})) },
    outboxEvent: { create: () => (writes.push("outbox"), Promise.resolve({})) },
  };
  const prisma = {
    report: {
      findFirst: ({ where }: { where: { status?: string } }) =>
        Promise.resolve(
          where.status === "FAILED"
            ? { id: 1n }
            : {
                id: 1n,
                status: "QUEUED",
                case: {
                  publicId: "case-id",
                  caseNumber: "SG-1",
                  branchId: null,
                  clientId: 4n,
                  assignedOpsUserId: 9n,
                },
              },
        ),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const service = new ReportRecoveryService(prisma);
  await service.markFailed(2n, "report-id", new Error("render failed"));
  assert.deepEqual(writes.slice(0, 3), [
    "report:FAILED",
    "notification",
    "audit",
  ]);
  const actor = {
    tenantId: 2n,
    userId: 3n,
    userPublicId: "user-id",
    roles: ["OPS_MANAGER"],
  } as Actor;
  assert.deepEqual(await service.retry(actor, "case-id", "report-id"), {
    id: "report-id",
    status: "QUEUED",
  });
  assert.ok(writes.includes("outbox"));
});

void test("retention removes both GPS fixes and queues one object deletion", async () => {
  let scrubbed: Record<string, unknown> | undefined;
  let deletes = 0;
  const tx = {
    verificationCase: {
      updateMany: ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.retentionHoldAt, null);
        return Promise.resolve({ count: 1 });
      },
    },
    fieldVisit: {
      updateMany: ({ data }: { data: Record<string, unknown> }) => {
        scrubbed = data;
        return Promise.resolve({ count: 1 });
      },
    },
    evidenceItem: { deleteMany: () => Promise.resolve({ count: 1 }) },
    auditEvent: { create: () => Promise.resolve({}) },
    outboxEvent: {
      createMany: ({ data }: { data: unknown[] }) => {
        deletes += data.length;
        return Promise.resolve({ count: data.length });
      },
    },
  };
  const prisma = {
    tenantFieldPolicy: {
      findMany: () => Promise.resolve([{ tenantId: 1n, retentionDays: 30 }]),
    },
    fieldVisit: {
      findMany: () =>
        Promise.resolve([
          {
            id: 2n,
            caseId: 3n,
            publicId: "visit-id",
            evidence: [{ objectKey: "private/object" }],
          },
        ]),
    },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const worker = new RetentionWorkerService(
    prisma,
    config(),
    new RuntimeHealthService(),
  );
  await (worker as unknown as { run(): Promise<void> }).run();
  for (const field of [
    "capturedLatitude",
    "capturedLongitude",
    "checkInLatitude",
    "checkInLongitude",
    "checkedInAt",
  ]) {
    assert.equal(scrubbed?.[field], null);
  }
  assert.equal(deletes, 1);
});
