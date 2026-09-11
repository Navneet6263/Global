import assert from "node:assert/strict";
import test from "node:test";
import {
  documentReadiness,
  caseEvidenceReadiness,
  requiredDocumentTypes,
} from "../src/documents/evidence-readiness";
import { aggregateCheckRisk } from "../src/verification/case-risk";
import {
  documentExpiry,
  assertNotDuplicateDocument,
} from "../src/documents/upload-document-policy";
import { reminderTypes } from "../src/outbox/workflow-reminder.service";
import type { Prisma } from "../src/generated/prisma/client";

const today = new Date("2026-09-08T12:00:00Z");
const accepted = {
  type: "AADHAAR",
  status: "VERIFIED",
  currentVersion: 1,
  expiresAt: null,
};

void test("required document policy deduplicates known types and fails closed for invalid config", () => {
  assert.deepEqual(requiredDocumentTypes('["AADHAAR","AADHAAR","PAN"]'), [
    "AADHAAR",
    "PAN",
  ]);
  assert.throws(
    () => requiredDocumentTypes('["NOT_A_DOCUMENT"]'),
    /policy is invalid/,
  );
  assert.throws(() => requiredDocumentTypes("broken"), /policy is invalid/);
});

void test("upload alone cannot satisfy required reviewed evidence", () => {
  assert.equal(documentReadiness(["AADHAAR"], []).ready, false);
  assert.equal(
    documentReadiness(["AADHAAR"], [{ ...accepted, status: "AVAILABLE" }])
      .ready,
    false,
  );
  assert.equal(documentReadiness(["AADHAAR"], [accepted]).ready, true);
});

void test("legacy case policy does not change when its reusable package is edited", async () => {
  const tx = {
    verificationCase: {
      findUnique: () =>
        Promise.resolve({
          servicePackage: { requiredDocumentsJson: '["PAN"]' },
          documents: [],
        }),
    },
    caseService: { findMany: () => Promise.resolve([]) },
  } as unknown as Prisma.TransactionClient;
  const result = await caseEvidenceReadiness(tx, 1n, { includeWork: false });
  assert.deepEqual(result.requiredTypes, []);
  assert.equal(result.ready, true);
});

void test("new cases require the immutable union of selected service snapshots", async () => {
  const tx = {
    verificationCase: {
      findUnique: () => Promise.resolve({ documents: [accepted] }),
    },
    caseService: {
      findMany: () =>
        Promise.resolve([
          { requiredDocumentsJson: '["AADHAAR"]' },
          { requiredDocumentsJson: '["AADHAAR","PAN"]' },
        ]),
    },
  } as unknown as Prisma.TransactionClient;
  const result = await caseEvidenceReadiness(tx, 1n, { includeWork: false });
  assert.deepEqual(result.requiredTypes, ["AADHAAR", "PAN"]);
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.includes("PAN")));
});

void test("expired evidence fails but expiry today remains valid", () => {
  assert.equal(
    documentReadiness(
      ["AADHAAR"],
      [{ ...accepted, expiresAt: new Date("2026-09-07") }],
      today,
    ).ready,
    false,
  );
  assert.equal(
    documentReadiness(
      ["AADHAAR"],
      [{ ...accepted, expiresAt: new Date("2026-09-08") }],
      today,
    ).ready,
    true,
  );
});

void test("unresolved rejection fails readiness even when another accepted file exists", () => {
  const result = documentReadiness(
    ["AADHAAR"],
    [accepted, { ...accepted, type: "PAN", status: "REUPLOAD_REQUIRED" }],
  );
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => issue.includes("PAN")));
});

void test("case risk uses highest recorded finding and does not invent adverse risk", () => {
  assert.equal(
    aggregateCheckRisk([
      { riskLevel: "HIGH", result: "DISCREPANCY" },
      { riskLevel: null, result: "CLEAR" },
    ]),
    "HIGH",
  );
  assert.equal(
    aggregateCheckRisk([{ riskLevel: null, result: "UNABLE_TO_VERIFY" }]),
    null,
  );
  assert.equal(
    aggregateCheckRisk([
      { riskLevel: null, result: "CLEAR" },
      { riskLevel: null, result: "DISCREPANCY" },
    ]),
    null,
  );
  assert.equal(
    aggregateCheckRisk([{ riskLevel: null, result: "CLEAR" }]),
    "LOW",
  );
});

void test("expiry parsing rejects impossible dates", () => {
  assert.throws(() => documentExpiry("2026-02-30"), /valid date/);
  assert.throws(() => documentExpiry("09/08/2026"), /YYYY-MM-DD/);
  assert.equal(
    documentExpiry("2026-12-31")?.toISOString(),
    "2026-12-31T00:00:00.000Z",
  );
});

void test("duplicate inspection is limited to the current tenant and case", async () => {
  let received: unknown;
  const tx = {
    documentVersion: {
      findFirst: (query: unknown) => {
        received = query;
        return Promise.resolve({ id: 1n });
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    assertNotDuplicateDocument(tx, 17n, 42n, "hash"),
    /already attached to this case/,
  );
  assert.deepEqual(received, {
    where: { sha256: "hash", document: { tenantId: 17n, caseId: 42n } },
    select: { id: true },
  });
});

void test("reminders reflect overdue facts and do not flag recent complete intake", () => {
  const notices = reminderTypes(
    {
      dueAt: new Date("2026-09-07"),
      createdAt: new Date("2026-09-01"),
      clarificationDueDates: [new Date("2026-09-06")],
      documents: [],
      requiredTypes: ["AADHAAR"],
    },
    today,
  );
  assert.deepEqual(
    notices.map((notice) => notice.type),
    ["CASE_SLA_OVERDUE", "CLARIFICATION_OVERDUE", "DOCUMENTS_MISSING"],
  );
  assert.deepEqual(
    reminderTypes(
      {
        dueAt: null,
        createdAt: today,
        clarificationDueDates: [],
        documents: [accepted],
        requiredTypes: ["AADHAAR"],
      },
      today,
    ),
    [],
  );
});
