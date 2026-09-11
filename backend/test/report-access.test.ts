import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import { ReportAccessService } from "../src/reports/report-access.service";
import { ManagerReviewService } from "../src/reports/manager-review.service";
import { reportDownloadExpiry } from "../src/reports/report-access-policy";
import {
  reportApprovalSelect,
  snapshotForApproval,
  type ApprovalCase,
} from "../src/reports/report-snapshot";

void test("download expiry uses configured bounded days and rejects invalid configuration", () => {
  const previous = process.env.REPORT_DOWNLOAD_TTL_DAYS;
  try {
    process.env.REPORT_DOWNLOAD_TTL_DAYS = "7";
    assert.equal(
      reportDownloadExpiry(new Date("2026-09-08T00:00:00Z")).toISOString(),
      "2026-09-15T00:00:00.000Z",
    );
    for (const value of ["0", "-1", "1.5", "NaN", "3651"]) {
      process.env.REPORT_DOWNLOAD_TTL_DAYS = value;
      assert.throws(() => reportDownloadExpiry(), /REPORT_DOWNLOAD_TTL_DAYS/);
    }
  } finally {
    if (previous === undefined) delete process.env.REPORT_DOWNLOAD_TTL_DAYS;
    else process.env.REPORT_DOWNLOAD_TTL_DAYS = previous;
  }
});

void test("clients cannot preview unpaid reports or renew download access", async () => {
  const actor = { tenantId: 1n, userId: 2n, roles: ["CLIENT_ADMIN"] } as Actor;
  const service = new ReportAccessService(
    {} as PrismaService,
    {} as LocalObjectStorageService,
  );
  await assert.rejects(
    service.preview(actor, "report"),
    /operations manager or platform administrator/,
  );
  await assert.rejects(
    service.renew(actor, "report"),
    /operations manager or platform administrator/,
  );
});

void test("a source responder cannot manager-approve a case completed and QA-reviewed by other people", async () => {
  const actor = { tenantId: 1n, userId: 2n, roles: ["OPS_MANAGER"] } as Actor;
  let lookup: unknown;
  const tx = {
    verificationCase: {
      findFirst: () => ({
        id: 8n,
        version: 3,
        status: "MANAGER_REVIEW",
        reports: [],
        checks: [{ tasks: [{ completedById: 9n }] }],
        qaReviews: [{ decision: "APPROVED", reviewerId: 10n }],
      }),
    },
    auditEvent: {
      findFirst: (input: unknown) => {
        lookup = input;
        return { id: 99n };
      },
    },
  };
  const prisma = {
    $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    new ManagerReviewService(prisma, {} as SubjectPiiService).decide(
      actor,
      "case-id",
      {
        caseVersion: 3,
        decision: "APPROVED",
        notes: "Reviewed factual evidence",
        recommendation: "Reviewed outcome stated",
      },
    ),
    /independent of verification and QA/,
  );
  assert.deepEqual(lookup, {
    where: {
      tenantId: 1n,
      actorUserId: 2n,
      resourceType: "case",
      resourcePublicId: "case-id",
      action: "verification.method-responded",
    },
    select: { id: true },
  });
});

void test("manager renewal cannot revive a concurrently superseded report", async () => {
  const actor = {
    tenantId: 1n,
    userId: 2n,
    roles: ["PLATFORM_ADMIN"],
  } as Actor;
  const queries: unknown[] = [];
  const tx = {
    report: {
      updateMany: (input: unknown) => {
        queries.push(input);
        return { count: 0 };
      },
    },
    auditEvent: {
      create: () =>
        assert.fail("Rejected renewal must not be audited as successful"),
    },
  };
  const prisma = {
    report: { findFirst: () => ({ id: 7n, currentVersion: 2 }) },
    $transaction: (work: (value: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    new ReportAccessService(prisma, {} as LocalObjectStorageService).renew(
      actor,
      "report",
    ),
    /changed during access renewal/,
  );
  assert.deepEqual((queries[0] as { where: unknown }).where, {
    id: 7n,
    status: "PUBLISHED",
    currentVersion: 2,
  });
});

void test("approval snapshots include responded methods and current field evidence, not arbitrary configuration", () => {
  const at = new Date("2026-09-08T00:00:00Z");
  const row = {
    caseNumber: "SG-TEST",
    client: { displayName: "Client" },
    subject: { fullName: "Subject", employeeCode: null, dateOfBirth: null },
    riskLevel: "LOW",
    services: [
      {
        serviceFamily: "VENDORCHECK",
        configurationJson: '{"legalName":"Business","bankAccount":"secret"}',
      },
    ],
    qaReviews: [
      { createdAt: at, reviewer: { displayName: "Independent reviewer" } },
    ],
    documents: [
      {
        type: "PAN",
        versions: [{ originalName: "current.pdf", sha256: "current" }],
      },
      {
        type: "PAN",
        // A separate approved document of the same type, not an old file revision.
        versions: [
          { originalName: "second-approved.pdf", sha256: "second-approved" },
        ],
      },
    ],
    checks: [
      {
        type: "ADDRESS",
        result: "CLEAR",
        riskLevel: "LOW",
        sourceSummary: "Reviewed source",
        caseService: { serviceFamily: "VENDORCHECK" },
        methodRuns: [
          {
            method: "MANUAL",
            result: "CLEAR",
            provider: "Authorised source",
            reference: "REF-1",
          },
        ],
        findings: [],
      },
    ],
    fieldVisits: [
      {
        publicId: "visit",
        evidenceSince: at,
        evidence: [
          { type: "PHOTO", sha256: "new-photo", capturedAt: at, createdAt: at },
          {
            type: "PHOTO",
            sha256: "old-photo",
            capturedAt: at,
            createdAt: new Date(at.getTime() - 1),
          },
        ],
      },
    ],
  } as unknown as ApprovalCase;
  const snapshot = snapshotForApproval(
    row,
    "Manager",
    "Factual findings reviewed",
    at,
  );
  assert.deepEqual(reportApprovalSelect.checks.select.methodRuns.where, {
    status: "RESPONDED",
  });
  assert.deepEqual(reportApprovalSelect.documents.where, {
    status: "VERIFIED",
  });
  const method = snapshot.checks[0]?.methods?.[0];
  assert.ok(method, "Responded source method must be retained in the snapshot");
  assert.equal(method.reference, "REF-1");
  assert.deepEqual(
    snapshot.evidence?.map((item) => item.sha256),
    ["current", "second-approved", "new-photo"],
  );
  assert.deepEqual(snapshot.identityDetails, [
    ["Business legal name", "Business"],
  ]);
});
