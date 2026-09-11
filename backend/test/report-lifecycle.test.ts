import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import type { Prisma } from "../src/generated/prisma/client";
import { ManagerReviewService } from "../src/reports/manager-review.service";
import {
  reportPaymentReady,
  canReadReleasedReport,
} from "../src/reports/report-payment-policy";
import { releasePreparedReport } from "../src/reports/report-release";
import { legacyApprovalRequired } from "../src/reports/report-snapshot";
import type { ApprovalCase } from "../src/reports/report-snapshot";

const paid = {
  status: "PAID",
  totalAmount: "1180.00",
  paidAmount: "1180.00",
  creditedAmount: "0.00",
};

void test("report release needs actual complete cash payment, including every linked invoice", () => {
  assert.equal(reportPaymentReady([]), false);
  assert.equal(reportPaymentReady([{ ...paid, status: "CANCELLED" }]), false);
  assert.equal(
    reportPaymentReady([
      { ...paid, status: "PARTIALLY_PAID", paidAmount: "1000.00" },
    ]),
    false,
  );
  assert.equal(
    reportPaymentReady([
      {
        ...paid,
        status: "SETTLED",
        paidAmount: "1000.00",
        creditedAmount: "180.00",
      },
    ]),
    false,
  );
  assert.equal(
    reportPaymentReady([{ ...paid, totalAmount: 0, paidAmount: 0 }]),
    false,
  );
  assert.equal(
    reportPaymentReady([paid, { ...paid, status: "ISSUED", paidAmount: 0 }]),
    false,
  );
  assert.equal(
    reportPaymentReady([paid, { ...paid, status: "CANCELLED" }]),
    true,
  );
  assert.equal(reportPaymentReady([paid, paid]), true);
});

void test("v2 downloads need release metadata and unexpired access; legacy published files remain readable", () => {
  const now = new Date("2026-09-08T12:00:00Z");
  const report = {
    status: "PUBLISHED",
    workflowVersion: 2,
    releasedAt: now,
    downloadExpiresAt: new Date("2026-10-08T12:00:00Z"),
  };
  assert.equal(canReadReleasedReport(report, now), true);
  assert.equal(
    canReadReleasedReport({ ...report, status: "PREPARED" }, now),
    false,
  );
  assert.equal(
    canReadReleasedReport({ ...report, status: "SUPERSEDED" }, now),
    false,
  );
  assert.equal(
    canReadReleasedReport({ ...report, releasedAt: null }, now),
    false,
  );
  assert.equal(
    canReadReleasedReport({ ...report, downloadExpiresAt: now }, now),
    false,
  );
  assert.equal(
    canReadReleasedReport({ ...report, downloadExpiresAt: null }, now),
    false,
  );
  assert.equal(
    canReadReleasedReport(
      {
        ...report,
        workflowVersion: 1,
        releasedAt: null,
        downloadExpiresAt: now,
      },
      now,
    ),
    true,
  );
});

function releaseFixture(overrides: Record<string, unknown> = {}) {
  const writes: string[] = [];
  const report = {
    id: 7n,
    status: "PREPARED",
    currentVersion: 1,
    managerReviewId: 4n,
    managerReview: { decision: "APPROVED", caseId: 8n },
    case: {
      id: 8n,
      publicId: "case-id",
      status: "PAYMENT_PENDING",
      version: 3,
      clientId: 9n,
    },
    invoiceLines: [
      { invoice: { ...paid, id: 5n, tenantId: 1n, clientId: 9n } },
    ],
    ...overrides,
  };
  const tx = {
    report: {
      findFirst: () => report,
      updateMany: () => {
        writes.push("publish");
        return { count: 1 };
      },
    },
    verificationCase: {
      findUnique: () => ({ servicePackage: null, documents: [] }),
      updateMany: () => {
        writes.push("complete");
        return { count: 1 };
      },
    },
    caseService: { findMany: () => [] },
    caseCheck: { findMany: () => [] },
    clarification: { count: () => 0 },
    fieldVisit: { count: () => 0 },
    caseStatusHistory: {
      create: () => {
        writes.push("history");
      },
    },
    auditEvent: {
      create: () => {
        writes.push("audit");
      },
    },
    user: { findMany: () => [] },
  } as unknown as Prisma.TransactionClient;
  return { tx, writes };
}

void test("a prepared unpaid report cannot be released and creates no status/audit mutations", async () => {
  const { tx, writes } = releaseFixture({ invoiceLines: [] });
  assert.equal(await releasePreparedReport(tx, 1n, "report-id", 2n), false);
  assert.deepEqual(writes, []);
});

void test("cross-client invoice links cannot authorize report release", async () => {
  const { tx, writes } = releaseFixture({
    invoiceLines: [
      { invoice: { ...paid, id: 5n, tenantId: 1n, clientId: 99n } },
    ],
  });
  assert.equal(await releasePreparedReport(tx, 1n, "report-id", 2n), false);
  assert.deepEqual(writes, []);
});

void test("fully paid report release advances case and preserves actor history", async () => {
  const { tx, writes } = releaseFixture();
  assert.equal(await releasePreparedReport(tx, 1n, "report-id", 2n), true);
  assert.deepEqual(writes, ["publish", "complete", "history", "audit"]);
});

void test("payment can remain recorded while unresolved evidence holds report release", async () => {
  const { tx, writes } = releaseFixture();
  Object.assign(tx.clarification, { count: () => 1 });
  assert.equal(await releasePreparedReport(tx, 1n, "report-id", 2n), false);
  assert.deepEqual(writes, []);
});

void test("manager cannot approve their own QA decision even with Platform Admin access", async () => {
  const actor = {
    tenantId: 1n,
    userId: 2n,
    roles: ["PLATFORM_ADMIN"],
  } as Actor;
  const tx = {
    verificationCase: {
      findFirst: () => ({
        id: 8n,
        version: 3,
        status: "MANAGER_REVIEW",
        reports: [],
        checks: [],
        qaReviews: [{ id: 4n, decision: "APPROVED", reviewerId: 2n }],
      }),
    },
  };
  const prisma = {
    $transaction: (work: (arg: typeof tx) => Promise<unknown>) => work(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    new ManagerReviewService(prisma, {} as SubjectPiiService).decide(
      actor,
      "case-id",
      {
        caseVersion: 3,
        decision: "APPROVED",
        notes: "All source checks reviewed",
        recommendation: "Factual reviewed findings provided",
      },
    ),
    /independent of verification and QA/,
  );
});

void test("legacy approval recovery never repurposes an already published report", () => {
  const row = {
    status: "COMPLETED",
    qaReviews: [{ decision: "APPROVED" }],
    reports: [{ workflowVersion: 1, status: "QUEUED" }],
  } as ApprovalCase;
  assert.equal(legacyApprovalRequired(row), true);
  row.reports.push({ id: 2n, workflowVersion: 1, status: "PUBLISHED" });
  assert.equal(legacyApprovalRequired(row), false);
});
