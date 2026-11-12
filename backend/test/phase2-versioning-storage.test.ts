import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { DocumentReviewService } from "../src/documents/document-review.service";
import { DocumentsController } from "../src/documents/documents.controller";
import { DocumentsService } from "../src/documents/documents.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { RuntimeHealthService } from "../src/health/runtime-health.service";
import type { ObjectDeletionRecoveryService } from "../src/outbox/object-deletion-recovery.service";
import type { OutboxClaimService } from "../src/outbox/outbox-claim.service";
import { OutboxWorkerService } from "../src/outbox/outbox-worker.service";
import type { ReportRecoveryService } from "../src/reports/report-recovery.service";
import type { ReportsService } from "../src/reports/reports.service";

const actor = (roles: string[]): Actor => ({
  userId: 10n,
  userPublicId: "user-10",
  tenantId: 7n,
  tenantPublicId: "tenant-7",
  email: "ops@example.com",
  displayName: "Ops",
  mustChangePassword: false,
  roles,
  permissions: ["case:read", "document:read"],
});

const stubConfig = {
  get: (_k: string, fallback?: unknown) => fallback,
} as ConfigService;

const pdfFile = (name: string): UploadedBinary => ({
  fieldname: "file",
  originalName: name,
  mimetype: "application/pdf",
  size: 4,
  buffer: Buffer.from("%PDF"),
});

void test("uploadForCandidate preserves verified baseline and assigns MAX(version)+1 across retries", async () => {
  const docUpdates: Array<Record<string, unknown>> = [];
  const createdVersions: Array<Record<string, unknown>> = [];
  const outboxUpdates: Array<Record<string, unknown>> = [];
  const storedKeys: string[] = [];
  let maxVersion = 2;

  const prisma = {
    caseService: { findMany: () => Promise.resolve([{ requiredDocumentsJson: '["PAN"]' }]) },
    verificationCase: { updateMany: () => Promise.resolve({ count: 1 }) },
    document: {
      findMany: () => Promise.resolve([]),
      findFirst: () =>
        Promise.resolve({ id: 50n, publicId: "doc-pan", status: "VERIFIED", currentVersion: 1, version: 3 }),
      updateMany: (args: { data: Record<string, unknown> }) => {
        docUpdates.push(args.data);
        return Promise.resolve({ count: 1 });
      },
    },
    documentVersion: {
      findFirst: () => Promise.resolve(null),
      aggregate: () => Promise.resolve({ _max: { version: maxVersion } }),
      create: (args: { data: Record<string, unknown> }) => {
        createdVersions.push(args.data);
        maxVersion = args.data.version as number;
        return Promise.resolve({ ...args.data, sizeBytes: 4n, createdAt: new Date() });
      },
    },
    outboxEvent: {
      create: () => Promise.resolve({ id: 91n }),
      updateMany: (args: { data: Record<string, unknown> }) => {
        outboxUpdates.push(args.data);
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
    vendorAssignment: { findMany: () => Promise.resolve([]) },
    $executeRaw: () => Promise.resolve(1),
    $transaction: (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  } as unknown as PrismaService;

  const service = new DocumentsService(
    prisma,
    stubConfig,
    { inspect: () => Promise.resolve() } as unknown as ContentInspectionService,
    {
      put: (key: string) => {
        storedKeys.push(key);
        return Promise.resolve();
      },
      delete: () => Promise.resolve(),
    } as unknown as LocalObjectStorageService,
  );

  const res = await service.uploadForCandidate(
    { tenantId: 7n, tenantPublicId: "tenant-7", caseId: 30n, casePublicId: "case-30", caseStatus: "CLARIFICATION_PENDING" },
    "PAN",
    pdfFile("pan-v3.pdf"),
    undefined,
    { clarificationId: 99n, preserveVerifiedBaseline: true },
  );

  assert.equal(res.version, 3);
  assert.equal(storedKeys.length, 1);
  assert.deepEqual(docUpdates[0], { version: { increment: 1 } });
  assert.equal(createdVersions[0]?.version, 3);
  assert.equal(createdVersions[0]?.reviewStatus, "PENDING");
  assert.equal(createdVersions[0]?.clarificationId, 99n);
  assert.equal(outboxUpdates[0]?.status, "PROCESSED");
});

void test("failed DB upload recovery leaves expedited deletion lease and worker checks DocumentVersion before deleting", async () => {
  const deletedKeys: string[] = [];
  const completedIds: bigint[] = [];
  let deleteShouldThrow = true;
  let leaseAvailableAt: Date | undefined;

  const leasePrisma = {
    caseService: { findMany: () => Promise.resolve([{ requiredDocumentsJson: '["PAN"]' }]) },
    verificationCase: { updateMany: () => Promise.resolve({ count: 1 }) },
    document: {
      findFirst: () => Promise.resolve({ id: 50n, publicId: "doc-pan", status: "AVAILABLE", currentVersion: 0, version: 1 }),
      updateMany: () => Promise.resolve({ count: 0 }),
    },
    documentVersion: {
      findFirst: () => Promise.resolve(null),
      aggregate: () => Promise.resolve({ _max: { version: 0 } }),
    },
    outboxEvent: {
      create: () => Promise.resolve({ id: 404n }),
      updateMany: (args: { data: { availableAt?: Date } }) => {
        if (args.data.availableAt) leaseAvailableAt = args.data.availableAt;
        return Promise.resolve({ count: 1 });
      },
    },
    $executeRaw: () => Promise.resolve(1),
    $transaction: (fn: (tx: typeof leasePrisma) => Promise<unknown>) => fn(leasePrisma),
  } as unknown as PrismaService;

  const docs = new DocumentsService(
    leasePrisma,
    stubConfig,
    { inspect: () => Promise.resolve() } as unknown as ContentInspectionService,
    {
      put: () => Promise.resolve(),
      delete: (key: string) => {
        if (deleteShouldThrow) return Promise.reject(new Error("storage blip"));
        deletedKeys.push(key);
        return Promise.resolve();
      },
    } as unknown as LocalObjectStorageService,
  );

  await assert.rejects(
    docs.uploadForCandidate(
      { tenantId: 7n, tenantPublicId: "t", caseId: 30n, casePublicId: "c", caseStatus: "DOCUMENT_PENDING" },
      "PAN",
      pdfFile("p.pdf"),
    ),
    /concurrently/,
  );
  assert.ok(leaseAvailableAt instanceof Date);

  deleteShouldThrow = false;
  let referencedInDb = true;
  const worker = new OutboxWorkerService(
    { documentVersion: { findFirst: () => Promise.resolve(referencedInDb ? { id: 1n } : null) } } as unknown as PrismaService,
    {} as ReportsService,
    {
      delete: (key: string) => {
        deletedKeys.push(key);
        return Promise.resolve();
      },
    } as unknown as LocalObjectStorageService,
    {} as SecretBoxService,
    stubConfig,
    { complete: (ev: { id: bigint }) => { completedIds.push(ev.id); return Promise.resolve(true); } } as unknown as OutboxClaimService,
    {} as ReportRecoveryService,
    {} as ObjectDeletionRecoveryService,
    new RuntimeHealthService(),
    { configured: () => false } as never,
  );

  const runEvent = (id: bigint, key: string) =>
    (worker as unknown as { process: (e: unknown) => Promise<void> }).process({
      id,
      tenantId: 7n,
      topic: "object.delete.requested",
      aggregateType: "document_upload_lease",
      aggregateId: "doc-pan",
      payloadJson: JSON.stringify({ objectKey: key }),
      attempts: 1,
    });

  await runEvent(1n, "t/c/doc-pan/v1-keep");
  assert.deepEqual(deletedKeys, []);
  referencedInDb = false;
  await runEvent(2n, "t/c/doc-pan/v2-orphan");
  assert.deepEqual(deletedKeys, ["t/c/doc-pan/v2-orphan"]);
  assert.deepEqual(completedIds, [1n, 2n]);
});

void test("download/preview validate ?version and default to currentVersion when omitted", async () => {
  const queries: Array<number | undefined> = [];
  const service = new DocumentsService(
    {
      documentVersion: {
        findFirst: (args: { where: { version?: number } }) => {
          queries.push(args.where.version);
          if (args.where.version === 99) return Promise.resolve(null);
          return Promise.resolve({
            objectKey: args.where.version === 1 ? "k1" : "k2",
            originalName: "id.pdf",
            contentType: "application/pdf",
            version: args.where.version ?? 2,
            document: { type: "PAN", currentVersion: 1, case: { publicId: "c1", caseNumber: "SG-1" } },
          });
        },
      },
      auditEvent: { create: () => Promise.resolve({}) },
    } as unknown as PrismaService,
    stubConfig,
    {} as ContentInspectionService,
    { auditedStream: (_k: string, audit: () => Promise<unknown>) => audit().then(() => Buffer.from("pdf")) } as unknown as LocalObjectStorageService,
  );
  const controller = new DocumentsController(service, stubConfig, {} as DocumentReviewService);
  await controller.download(actor(["OPS_MANAGER"]), "doc-1");
  assert.deepEqual(queries, [undefined, 1]);
  await controller.preview(actor(["DATA_ENTRY"]), "doc-1", "2");
  assert.deepEqual(queries, [undefined, 1, 2]);
  await assert.rejects(() => controller.preview(actor(["OPS_MANAGER"]), "doc-1", "0"), BadRequestException);
});
