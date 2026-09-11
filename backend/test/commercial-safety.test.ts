import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { ClientAgreementFilesService } from "../src/clients/client-agreement-files.service";
import { RetentionWorkerService } from "../src/outbox/retention-worker.service";
import { RuntimeHealthService } from "../src/health/runtime-health.service";
import { leastLoadedOwner } from "../src/crm/crm-auto-assignment.controller";

void test("assisted allocation is stable on equal workloads and never mutates input", () => {
  const owners = [
    { id: 4n, activeCount: 3 },
    { id: 2n, activeCount: 1 },
    { id: 1n, activeCount: 1 },
  ];
  assert.equal(leastLoadedOwner(owners)?.id, 1n);
  assert.deepEqual(
    owners.map((row) => row.id),
    [4n, 2n, 1n],
  );
  assert.equal(leastLoadedOwner([]), undefined);
});

void test("uncertain contract commit preserves referenced bytes; failed orphan cleanup queues recovery", async () => {
  const actor = { tenantId: 1n, tenantPublicId: "tenant", userId: 2n } as Actor;
  for (const referenced of [1, 0]) {
    let removed = false;
    let savedKey = "";
    let queued: Record<string, unknown> | undefined;
    const db = {
      clientAgreement: {
        findFirst: () =>
          Promise.resolve({ id: 3n, client: { id: 4n, version: 1 } }),
      },
      clientAgreementFile: { count: () => Promise.resolve(referenced) },
      $transaction: () => Promise.reject(new Error("uncertain commit")),
      outboxEvent: {
        create: ({ data }: { data: Record<string, unknown> }) => {
          queued = data;
          return Promise.resolve({});
        },
      },
    } as unknown as PrismaService;
    const storage = {
      put: (key: string) => {
        savedKey = key;
        return Promise.resolve();
      },
      delete: () => {
        removed = true;
        return Promise.reject(new Error("storage unavailable"));
      },
    } as unknown as LocalObjectStorageService;
    const inspection = {
      inspect: () => Promise.resolve(),
    } as unknown as ContentInspectionService;
    const service = new ClientAgreementFilesService(db, inspection, storage);
    await assert.rejects(
      service.upload(actor, "client", "agreement", {
        buffer: Buffer.from("fixture"),
        size: 7,
        mimetype: "application/pdf",
        originalName: "fixture.pdf",
      }),
      /uncertain commit/,
    );
    assert.equal(removed, referenced === 0);
    if (referenced) assert.equal(queued, undefined);
    else {
      assert.equal(queued?.topic, "object.delete.requested");
      assert.deepEqual(JSON.parse(queued?.payloadJson as string), {
        objectKey: savedKey,
      });
      assert.match(savedKey, /^tenant\/commercial\/client\/agreement\//);
    }
  }
});

void test("a hold set after retention selection prevents GPS/evidence/deletion mutations", async () => {
  let attemptedMutation = false;
  const forbidden = () => {
    attemptedMutation = true;
    throw new Error("A held case must not be mutated");
  };
  const tx = {
    verificationCase: {
      updateMany: ({ where }: { where: Record<string, unknown> }) => {
        assert.equal(where.retentionHoldAt, null);
        return Promise.resolve({ count: 0 });
      },
    },
    fieldVisit: { updateMany: forbidden },
    evidenceItem: { deleteMany: forbidden },
    outboxEvent: { createMany: forbidden },
  };
  const db = {
    tenantFieldPolicy: {
      findMany: () => Promise.resolve([{ tenantId: 1n, retentionDays: 30 }]),
    },
    fieldVisit: {
      findMany: () =>
        Promise.resolve([
          { id: 2n, caseId: 3n, publicId: "visit", evidence: [] },
        ]),
    },
    $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const worker = new RetentionWorkerService(
    db,
    new ConfigService({}),
    new RuntimeHealthService(),
  );
  await (worker as unknown as { run(): Promise<void> }).run();
  assert.equal(attemptedMutation, false);
});
