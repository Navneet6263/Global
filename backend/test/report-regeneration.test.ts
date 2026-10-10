import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import type { ReportPdfService } from "../src/reports/report-pdf.service";
import { ReportRegenerationService } from "../src/reports/report-regeneration.service";

const rm = {
  tenantId: 1n,
  userId: 50n,
  roles: ["SPOC_RM"],
  spocClients: [{ id: 3n }],
} as unknown as Actor;

const snapshot = JSON.stringify({
  caseNumber: "SG-1",
  clientName: "Client",
  candidateName: "Candidate",
  completedAt: "2026-10-10T09:00:00Z",
  riskLevel: null,
  checks: [],
});

function fixture(report: Record<string, unknown> | null) {
  const stored: string[] = [];
  const deleted: string[] = [];
  const versions: Array<Record<string, unknown>> = [];
  const audits: Array<{ action: string; afterJson: string }> = [];
  const tx = {
    report: { updateMany: () => ({ count: 1 }) },
    reportVersion: {
      create: (args: { data: Record<string, unknown> }) =>
        versions.push(args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string; afterJson: string } }) =>
        audits.push(args.data),
    },
  };
  const prisma = {
    report: { findFirst: () => report },
    reportVersion: { aggregate: () => ({ _max: { version: 1 } }) },
    checkEvidence: { findMany: () => [] },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const storage = {
    put: (key: string) => {
      stored.push(key);
      return Promise.resolve();
    },
    delete: (key: string) => {
      deleted.push(key);
      return Promise.resolve();
    },
  } as unknown as LocalObjectStorageService;
  const pdf = {
    render: () => Promise.resolve(Buffer.from("%PDF-1.7 regenerated")),
  } as unknown as ReportPdfService;
  return {
    service: new ReportRegenerationService(prisma, storage, pdf),
    stored,
    versions,
    audits,
  };
}

const approved = {
  id: 7n,
  publicId: "report-1",
  status: "PUBLISHED",
  workflowVersion: 2,
  currentVersion: 1,
  tenant: { publicId: "tenant-1" },
  case: { publicId: "case-1", caseNumber: "SG-1" },
  managerReview: { decision: "APPROVED", snapshotJson: snapshot },
};

void test("the RM rebuilds a released report as a new, audited version", async () => {
  const { service, stored, versions, audits } = fixture(approved);
  const result = await service.regenerate(
    rm,
    "case-1",
    "report-1",
    "Stored PDF went missing from storage",
  );
  assert.equal(result.version, 2);
  assert.match(result.authenticityCode, /^SG-[0-9A-F]{12}$/);
  assert.match(stored[0]!, /^tenant-1\/case-1\/reports\/report-1\/v2-/);
  assert.equal(versions[0]!.version, 2);
  assert.equal(versions[0]!.generatedById, 50n);
  assert.equal(audits[0]!.action, "report.regenerated");
  assert.match(audits[0]!.afterJson, /"previousVersion":1/);
  assert.match(audits[0]!.afterJson, /Stored PDF went missing/);
});

void test("only an approved, prepared or released report of a visible case can be rebuilt", async () => {
  await assert.rejects(
    fixture(null).service.regenerate(
      rm,
      "case-1",
      "report-x",
      "Missing file reason",
    ),
    NotFoundException,
  );
  await assert.rejects(
    fixture({ ...approved, status: "QUEUED" }).service.regenerate(
      rm,
      "case-1",
      "report-1",
      "Missing file reason",
    ),
    ConflictException,
  );
  await assert.rejects(
    fixture({
      ...approved,
      managerReview: { decision: "REWORK", snapshotJson: snapshot },
    }).service.regenerate(rm, "case-1", "report-1", "Missing file reason"),
    ConflictException,
  );
});
