import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "node:util";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { ClientCommercialService } from "../src/clients/client-commercial.service";
import type { ClientAgreementFilesService } from "../src/clients/client-agreement-files.service";
import { ClientsService } from "../src/clients/clients.service";
import { Permission } from "../src/common/auth/permissions";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { PrismaService } from "../src/database/prisma.service";
import { OpsOnboardingController } from "../src/onboarding/onboarding.controller";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const CLIENT = "00000000-0000-4000-8000-000000000040";
const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
const ops = testActor(["OPS_MANAGER"], [Permission.ClientRead]);
const assignedRm = testActor(["SPOC_RM"], [], { userId: 60n });
const otherRm = testActor(["SPOC_RM"], [], { userId: 61n });

const company = (status = "ONBOARDING", files: unknown[] = []) => ({
  id: 40n,
  publicId: CLIENT,
  code: "NOVA",
  legalName: "Nova Foods",
  displayName: "Nova Foods",
  contactName: "Asha",
  contactEmail: "asha@nova.example",
  contactPhone: null,
  status,
  gstin: null,
  pan: null,
  billingAddress: null,
  billingTerms: null,
  version: 3,
  selfSignupAt: null,
  createdAt: new Date("2026-10-30T00:00:00Z"),
  onboardingSubmittedAt: null,
  onboardingNote: null,
  primaryRmUserId: 60n,
  primaryRmAssignedAt: null,
  primaryRm: null,
  packageRates: [],
  agreements: files.length
    ? [{ publicId: "agr-1", type: "AGREEMENT", signedAt: null, expiresAt: null, files }]
    : [],
});

function harness(row = company()) {
  const seen = {
    uploads: [] as string[],
    updates: [] as unknown[],
    listWhere: undefined as unknown,
    findWhere: undefined as unknown,
    notices: 0,
  };
  const prisma = {
    client: {
      findFirst: (input: { where: unknown }) => {
        seen.findWhere = input.where;
        return Promise.resolve(row);
      },
      findMany: (input: { where: unknown }) => {
        seen.listWhere ??= input.where;
        return Promise.resolve([]);
      },
      count: () => Promise.resolve(0),
      updateMany: (input: unknown) => {
        seen.updates.push(input);
        return Promise.resolve({ count: 1 });
      },
    },
    clientAgreement: {
      create: () => Promise.resolve({ publicId: "agr-1" }),
      updateMany: () => Promise.resolve({ count: 1 }),
    },
    servicePackage: { findMany: () => Promise.resolve([]) },
    auditEvent: {
      findMany: () => Promise.resolve([]),
      create: () => Promise.resolve({}),
    },
    user: { findMany: () => Promise.resolve([{ id: 9n, userRoles: [] }]) },
    notification: {
      createMany: () => {
        seen.notices += 1;
        return Promise.resolve({ count: 1 });
      },
    },
    $transaction: (work: (tx: unknown) => Promise<unknown>) => work(prisma),
  };
  const files = {
    upload: (_actor: unknown, _client: string, agreement: string) => {
      seen.uploads.push(agreement);
      return Promise.resolve({ id: "file-1", revision: 1 });
    },
  } as unknown as ClientAgreementFilesService;
  const service = new OnboardingService(
    prisma as unknown as PrismaService,
    files,
    {} as ClientCommercialService,
    {} as SecretBoxService,
    { get: () => "https://portal.example" } as unknown as ConfigService,
  );
  return { service, seen };
}

const file = { originalName: "gst.pdf" } as UploadedBinary;
const details = {
  version: 3,
  legalName: "Nova Foods Pvt Ltd",
  displayName: "Nova Foods",
  gstin: "29ABCDE1234F1Z5",
  pan: "ABCDE1234F",
  billingAddress: "Bengaluru",
};

void test("a company added by the team starts in onboarding, not active", async () => {
  let data: { status?: string } = {};
  const tx = {
    client: {
      create: (input: { data: { status?: string } }) => {
        data = input.data;
        return Promise.resolve({ publicId: CLIENT });
      },
    },
    auditEvent: { create: () => Promise.resolve({}) },
  };
  const prisma = {
    client: { findFirst: () => Promise.resolve(null) },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  };
  await new ClientsService(prisma as unknown as PrismaService).create(ops, {
    code: "nova",
    legalName: "Nova Foods",
    displayName: "Nova Foods",
    slaHours: 72,
  });
  assert.equal(data.status, "ONBOARDING");
});

void test("the board and the company page include companies added by the team", async () => {
  const { service, seen } = harness();
  await service.list(ops, {});
  assert.ok(!inspect(seen.listWhere, { depth: 8 }).includes("selfSignupAt"));
  const detail = (await service.detail(ops, CLIENT)) as unknown as {
    source: string;
    signedUpAt: Date;
    canSetUp: boolean;
    canSetPrice: boolean;
  };
  assert.ok(!inspect(seen.findWhere, { depth: 8 }).includes("selfSignupAt"));
  assert.equal(detail.source, "ADDED_BY_SAPLING");
  assert.ok(detail.signedUpAt instanceof Date);
  assert.equal(detail.canSetUp, true);
  assert.equal(detail.canSetPrice, true);
});

void test("Operations, Admin and the assigned RM can set up; another RM cannot", async () => {
  for (const who of [ops, admin, assignedRm]) {
    const { service, seen } = harness();
    await service.uploadCompanyDocument(who, CLIENT, "GST_CERTIFICATE", undefined, file);
    assert.equal(seen.uploads.length, 1);
    assert.equal(seen.notices, 1);
    await service.updateCompanyDetails(who, CLIENT, details);
    assert.equal(seen.updates.length, 1);
  }
  const { service, seen } = harness();
  await assert.rejects(
    service.uploadCompanyDocument(otherRm, CLIENT, "PAN", undefined, file),
    ForbiddenException,
  );
  await assert.rejects(
    service.updateCompanyDetails(otherRm, CLIENT, details),
    ForbiddenException,
  );
  assert.equal(seen.uploads.length, 0);
});

void test("an active company can still renew documents; a suspended one cannot", async () => {
  const active = harness(company("ACTIVE"));
  await active.service.uploadCompanyDocument(ops, CLIENT, "AGREEMENT", "2026-10-01", file);
  assert.equal(active.seen.uploads.length, 1);
  const suspended = harness(company("SUSPENDED"));
  await assert.rejects(
    suspended.service.uploadCompanyDocument(ops, CLIENT, "AGREEMENT", undefined, file),
    ConflictException,
  );
});

void test("Admin sets up but never approves or reviews", async () => {
  const { service } = harness();
  await assert.rejects(
    service.activate(admin, CLIENT, { version: 3 }),
    ForbiddenException,
  );
  await assert.rejects(
    service.review(admin, CLIENT, "agr-1", "file-1", {} as never),
    ForbiddenException,
  );
  // The view-only guard lets set-up through and keeps decisions closed.
  for (const handler of ["uploadDocument", "updateCompany", "commercial"])
    assert.ok(passesGuard(OpsOnboardingController, handler, admin), handler);
  for (const handler of ["activate", "reject", "review"])
    assert.ok(!passesGuard(OpsOnboardingController, handler, admin), handler);
});

void test("the viewer is told when it uploaded a file, so a colleague must review it", async () => {
  const uploaded = {
    publicId: "file-1",
    revision: 1,
    status: "PENDING",
    originalName: "msa.pdf",
    mimeType: "application/pdf",
    sizeBytes: 10,
    createdAt: new Date(),
    reviewNotes: null,
    reviewedAt: null,
    version: 1,
    uploadedById: ops.userId,
    uploadedBy: { displayName: "Ops" },
  };
  const { service } = harness(company("ONBOARDING", [uploaded]));
  const mine = (await service.detail(ops, CLIENT)) as unknown as {
    documents: Array<{ type: string; file: { uploadedByMe?: boolean } | null }>;
  };
  assert.equal(mine.documents.find((row) => row.type === "AGREEMENT")?.file?.uploadedByMe, true);
  const theirs = (await service.detail(assignedRm, CLIENT)) as unknown as typeof mine;
  assert.equal(theirs.documents.find((row) => row.type === "AGREEMENT")?.file?.uploadedByMe, false);
});
