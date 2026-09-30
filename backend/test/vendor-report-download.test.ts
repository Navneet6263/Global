import "reflect-metadata";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { VendorReportFileService } from "../src/vendor-requests/services/vendor-report-file.service";
import { SpocVendorsController } from "../src/vendor-requests/spoc-vendors.controller";
import { VendorReportsController } from "../src/vendor-requests/vendor-reports.controller";
import { VendorReportsRepository } from "../src/vendor-requests/vendor-reports.repository";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";
import { REQ, spocA } from "./helpers/vendor-fixtures";
import { mainVendor, teamUser } from "./helpers/vendor-team-fixtures";

type Call = { name: string; args: Record<string, unknown> };

function files(row: unknown) {
  const calls: Call[] = [];
  const prisma = {
    vendorAssignment: {
      findFirst: (args: Record<string, unknown>) => {
        calls.push({ name: "find", args });
        return Promise.resolve(row);
      },
    },
    auditEvent: {
      create: (args: Record<string, unknown>) => {
        calls.push({ name: "audit", args });
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaService;
  const storage = {
    auditedStream: async (key: string, audit: () => Promise<unknown>) => {
      calls.push({ name: "stream", args: { key } });
      await audit();
      return Readable.from(["report"]);
    },
  } as unknown as LocalObjectStorageService;
  return {
    service: new VendorReportFileService(
      new VendorReportsRepository(prisma),
      storage,
    ),
    calls,
  };
}

const withReport = {
  publicId: REQ,
  case: { caseNumber: "SG-20260928-600E89" },
  reports: [
    {
      publicId: "rep-2",
      version: 2,
      objectKey: "t/vendor-reports/x",
      contentType: "application/pdf",
    },
  ],
};

void test("SPOC-RM gets the latest report of an approved attempt of its own client only", async () => {
  const { service, calls } = files(withReport);
  const file = await service.forSpoc(spocA, REQ, "download");
  const where = calls[0]!.args.where as Record<string, unknown>;
  assert.equal(where.status, "APPROVED");
  assert.deepEqual(where.case, { tenantId: 7n, clientId: { in: [21n] } });
  const audit = calls.find((call) => call.name === "audit")!.args
    .data as Record<string, unknown>;
  assert.equal(audit.action, "vendor_assignment.report-downloaded");
  assert.equal(audit.actorUserId, 11n);
  assert.match(
    String(file.getHeaders().disposition),
    /^attachment; filename="vendor-report-SG-20260928-600E89-v2\.pdf"$/,
  );
  assert.equal(file.getHeaders().type, "application/pdf");
});

void test("a preview streams inline and is audited as a preview, not as a download", async () => {
  const { service, calls } = files({
    ...withReport,
    reports: [{ ...withReport.reports[0]!, contentType: "image/png" }],
  });
  const file = await service.forSpoc(spocA, REQ, "preview");
  assert.match(
    String(file.getHeaders().disposition),
    /^inline; filename=".*\.png"$/,
  );
  const audit = calls.find((call) => call.name === "audit")!.args
    .data as Record<string, unknown>;
  assert.equal(audit.action, "vendor_assignment.report-previewed");
});

void test("another client's, unapproved or report-less requests are not found", async () => {
  await assert.rejects(
    files(null).service.forSpoc(spocA, REQ, "download"),
    NotFoundException,
  );
  await assert.rejects(
    files({ ...withReport, reports: [] }).service.forSpoc(
      spocA,
      REQ,
      "download",
    ),
    NotFoundException,
  );
});

void test("vendors stream only their own requests' reports; a team user only delegated ones", async () => {
  const main = files(withReport);
  await main.service.forVendor(mainVendor, REQ, "download");
  const mainWhere = main.calls[0]!.args.where as Record<string, unknown>;
  assert.equal(mainWhere.vendorUserId, 31n);
  assert.equal(mainWhere.status, "APPROVED");
  const member = files(withReport);
  await member.service.forVendor(teamUser, REQ, "preview");
  const memberWhere = member.calls[0]!.args.where as Record<string, unknown>;
  assert.equal(memberWhere.handlerUserId, 41n);
});

void test("report routes keep the existing guards", () => {
  assert.ok(passesGuard(SpocVendorsController, "report", spocA));
  assert.ok(!passesGuard(SpocVendorsController, "report", mainVendor));
  for (const method of ["upload", "report"]) {
    assert.ok(passesGuard(VendorReportsController, method, mainVendor), method);
    assert.ok(passesGuard(VendorReportsController, method, teamUser), method);
    for (const role of [
      "SPOC_RM",
      "OPS_MANAGER",
      "CLIENT_ADMIN",
      "SUPPORT_AGENT",
    ])
      assert.ok(
        !passesGuard(VendorReportsController, method, testActor([role], ["*"])),
        role,
      );
  }
});
