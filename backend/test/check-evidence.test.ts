import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { CheckEvidenceService } from "../src/verification/check-evidence.service";

const verifier = {
  tenantId: 1n,
  tenantPublicId: "tenant-1",
  userId: 21n,
  roles: ["VERIFIER"],
  departments: [],
} as unknown as Actor;
const other = { ...verifier, userId: 22n };
const lead = {
  ...verifier,
  userId: 30n,
  departments: [{ id: 4n, role: "LEAD", kind: "VERIFICATION" }],
} as unknown as Actor;
const qa = {
  tenantId: 1n,
  userId: 40n,
  roles: ["QA_REVIEWER"],
} as unknown as Actor;

const png: UploadedBinary = {
  buffer: Buffer.from("png"),
  mimetype: "image/png",
  originalName: "aadhaar-portal.png",
  size: 3,
};

function fixture(check: Record<string, unknown> = {}, existing = 0) {
  const audits: Array<{ action: string; afterJson: string }> = [];
  const stored: string[] = [];
  const created: Array<Record<string, unknown>> = [];
  const row = {
    id: 7n,
    publicId: "check-1",
    status: "IN_PROGRESS",
    departmentId: 4n,
    case: { publicId: "case-1", status: "IN_PROGRESS", assignedOpsUserId: 11n },
    tasks: [{ assigneeId: 21n, status: "IN_PROGRESS" }],
    ...check,
  };
  const tx = {
    checkEvidence: {
      create: (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { publicId: "file-1", createdAt: new Date() };
      },
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    caseCheck: { findFirst: () => row },
    checkEvidence: { count: () => existing, findMany: () => [] },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const storage = {
    put: (key: string) => {
      stored.push(key);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
  } as unknown as LocalObjectStorageService;
  const inspection = {
    inspect: () => Promise.resolve(),
  } as unknown as ContentInspectionService;
  return {
    service: new CheckEvidenceService(prisma, storage, inspection),
    audits,
    stored,
    created,
  };
}

void test("the working verifier uploads a screenshot with a caption; it is stored and audited", async () => {
  const { service, audits, stored, created } = fixture();
  const result = await service.upload(
    verifier,
    "check-1",
    png,
    "Verified on UIDAI portal",
  );
  assert.equal(result.caption, "Verified on UIDAI portal");
  assert.match(stored[0]!, /^tenant-1\/check-evidence\/check-1\//);
  assert.match(String(created[0]!.sha256), /^[0-9a-f]{64}$/);
  assert.equal(audits[0]!.action, "check.evidence-uploaded");
});

void test("only the verifier, its Team Leader or Operations add proof, and only while open", async () => {
  await assert.rejects(
    fixture().service.upload(other, "check-1", png),
    ForbiddenException,
  );
  assert.ok(await fixture().service.upload(lead, "check-1", png));
  await assert.rejects(
    fixture({ status: "COMPLETED" }).service.upload(verifier, "check-1", png),
    ForbiddenException,
  );
  await assert.rejects(
    fixture().service.upload(verifier, "check-1", {
      ...png,
      mimetype: "text/html",
    }),
    /PDF, PNG or JPEG/,
  );
  await assert.rejects(
    fixture({}, 15).service.upload(verifier, "check-1", png),
    /At most 15/,
  );
});

void test("QA can open the proof list; another verifier cannot see it", async () => {
  const list = await fixture().service.list(qa, "check-1");
  assert.equal(list.canEdit, false);
  await assert.rejects(
    fixture().service.list(other, "check-1"),
    NotFoundException,
  );
});
