import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UploadedBinary } from "../src/common/http/uploaded-binary";
import type { PrismaService } from "../src/database/prisma.service";
import { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { UploadVendorReportService } from "../src/vendor-requests/services/upload-vendor-report.service";
import { REPORT_MAX_BYTES } from "../src/vendor-requests/services/vendor-report-rules";
import { VendorReportsRepository } from "../src/vendor-requests/vendor-reports.repository";
import { bigJson } from "./helpers/test-actor";
import { REQ } from "./helpers/vendor-fixtures";
import { mainVendor, teamUser } from "./helpers/vendor-team-fixtures";

type Call = { name: string; args: Record<string, unknown> };

const pdf = (size = 64): UploadedBinary => {
  const buffer = Buffer.concat([
    Buffer.from("%PDF-1.4\n"),
    Buffer.alloc(Math.max(0, size - 9), 32),
  ]);
  return {
    buffer,
    mimetype: "application/pdf",
    originalName: "report.pdf",
    size: buffer.length,
  };
};
const png = (): UploadedBinary => {
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
  ]);
  return {
    buffer,
    mimetype: "image/png",
    originalName: "report.png",
    size: buffer.length,
  };
};

const approved = (extra: Record<string, unknown> = {}) => ({
  id: 61n,
  publicId: REQ,
  status: "APPROVED",
  clientId: 21n,
  assignedById: 11n,
  case: { caseNumber: "SG-1" },
  document: { type: "EDUCATION_CERTIFICATE" },
  client: { publicId: "client-a", displayName: "Client A" },
  vendor: { displayName: "XYZ Vendors" },
  ...extra,
});

function uploader(
  options: {
    request?: unknown;
    latest?: { version: number; sha256: string } | null;
    locked?: number;
    inspection?: ContentInspectionService;
  } = {},
) {
  const calls: Call[] = [];
  const record =
    (name: string, result: unknown) =>
    (args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      return Promise.resolve(result);
    };
  const tx = {
    vendorAssignment: {
      updateMany: record("lock", { count: options.locked ?? 1 }),
    },
    vendorReport: {
      findFirst: record("latest", options.latest ?? null),
      create: (args: { data: Record<string, unknown> }) => {
        calls.push({ name: "create", args });
        return Promise.resolve({
          publicId: "rep-1",
          version: args.data.version,
          originalName: args.data.originalName,
          contentType: args.data.contentType,
          sizeBytes: args.data.sizeBytes,
          createdAt: new Date(0),
          uploadedBy: { displayName: "XYZ Vendors" },
        });
      },
    },
    auditEvent: { create: record("audit", {}) },
    user: { findMany: record("recipients", [{ id: 71n }]) },
    notification: { createMany: record("notify", {}) },
  };
  const prisma = {
    vendorAssignment: {
      findFirst: record(
        "request",
        "request" in options ? options.request : approved(),
      ),
    },
    vendorReport: { count: record("referenced", 0) },
    outboxEvent: { create: record("outbox", {}) },
    $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  const inspection =
    options.inspection ??
    ({
      inspect: (file: UploadedBinary, max: number, opts: unknown) => {
        calls.push({ name: "inspect", args: { max, opts } });
        return Promise.resolve();
      },
    } as unknown as ContentInspectionService);
  const storage = {
    put: record("put", undefined),
    delete: record("delete", undefined),
  } as unknown as LocalObjectStorageService;
  const service = new UploadVendorReportService(
    new VendorReportsRepository(prisma),
    inspection,
    storage,
  );
  return { service, calls, names: () => calls.map((call) => call.name) };
}

void test("a Main Vendor attaches a PDF report to an approved request and SPOC-RM is told", async () => {
  const { service, calls } = uploader();
  const view = await service.upload(mainVendor, REQ, pdf());
  assert.equal(view.version, 1);
  const find = calls.find((call) => call.name === "request")!.args.where;
  assert.deepEqual(find, { tenantId: 7n, vendorUserId: 31n, publicId: REQ });
  assert.deepEqual(calls.find((call) => call.name === "inspect")!.args, {
    max: REPORT_MAX_BYTES,
    opts: { documentType: "OTHER" },
  });
  assert.deepEqual(calls.find((call) => call.name === "lock")!.args.where, {
    id: 61n,
    status: "APPROVED",
  });
  const data = calls.find((call) => call.name === "create")!.args
    .data as Record<string, unknown>;
  assert.equal(data.contentType, "application/pdf");
  assert.equal(data.uploadedById, 31n);
  assert.match(String(data.objectKey), /\/vendor-reports\//);
  const audit = calls.find((call) => call.name === "audit")!.args
    .data as Record<string, unknown>;
  assert.equal(audit.action, "vendor_assignment.report-uploaded");
  assert.equal(audit.resourceType, "vendor_assignment");
  assert.match(
    bigJson(calls.find((call) => call.name === "recipients")!.args.where),
    /"spocClientScopes":\{"some":\{"clientId":"21"\}\}/,
  );
  const notices = calls.find((call) => call.name === "notify")!.args
    .data as Array<Record<string, unknown>>;
  assert.equal(notices[0]!.type, "VENDOR_REPORT_AVAILABLE");
  assert.equal(notices[0]!.href, "/spoc-rm/vendors?clientId=client-a");
});

void test("a delegated team user uploads too; a replacement becomes the next version", async () => {
  const { service, calls } = uploader({
    latest: { version: 2, sha256: "0".repeat(64) },
  });
  const view = await service.upload(teamUser, REQ, png());
  assert.equal(view.version, 3);
  const where = calls.find((call) => call.name === "request")!.args
    .where as Record<string, unknown>;
  assert.equal(where.handlerUserId, 41n);
  assert.equal(where.vendorUserId, 31n);
});

void test("only PDF or PNG up to 2 MB, checked before anything is stored", async () => {
  const jpeg: UploadedBinary = {
    ...pdf(),
    mimetype: "image/jpeg",
    originalName: "x.jpg",
  };
  for (const file of [jpeg, pdf(REPORT_MAX_BYTES + 1)]) {
    const { service, names } = uploader();
    await assert.rejects(
      service.upload(mainVendor, REQ, file),
      BadRequestException,
    );
    assert.deepEqual(names(), []);
  }
  // A PNG whose bytes are really a PDF is refused by the shared content inspection.
  const real = uploader({
    inspection: new ContentInspectionService(new ConfigService({})),
  });
  await assert.rejects(
    real.service.upload(mainVendor, REQ, { ...pdf(), mimetype: "image/png" }),
    /do not match/,
  );
  assert.ok(!real.names().includes("put"));
});

void test("reports need an approved request in the caller's own scope", async () => {
  const missing = uploader({ request: null });
  await assert.rejects(
    missing.service.upload(teamUser, REQ, pdf()),
    NotFoundException,
  );
  for (const status of ["PENDING", "REJECTED"]) {
    const early = uploader({ request: approved({ status }) });
    await assert.rejects(
      early.service.upload(mainVendor, REQ, pdf()),
      ConflictException,
    );
    assert.ok(!early.names().includes("put"));
  }
});

void test("duplicates, the version cap and races are refused and the stored file is removed", async () => {
  const file = pdf();
  const { createHash } = await import("node:crypto");
  const sha = createHash("sha256").update(file.buffer).digest("hex");
  const duplicate = uploader({ latest: { version: 1, sha256: sha } });
  await assert.rejects(
    duplicate.service.upload(mainVendor, REQ, file),
    /already the latest/,
  );
  assert.ok(
    duplicate.names().includes("delete"),
    "the unreferenced object is deleted",
  );
  const full = uploader({ latest: { version: 10, sha256: "1".repeat(64) } });
  await assert.rejects(
    full.service.upload(mainVendor, REQ, pdf()),
    /at most 10/,
  );
  const raced = uploader({ locked: 0 });
  await assert.rejects(raced.service.upload(mainVendor, REQ, pdf()), /refresh/);
  assert.ok(!raced.names().includes("create"));
});
