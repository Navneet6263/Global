import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import { caseEvidenceReadiness } from "../src/documents/evidence-readiness";
import {
  assertMethodEvidenceCurrent,
  captureMethodEvidence,
  parseMethodEvidence,
} from "../src/verification/method-evidence.policy";

const doc = {
  publicId: "document-one",
  status: "VERIFIED",
  currentVersion: 2,
  expiresAt: null,
  versions: [{ version: 2, createdAt: new Date("2026-09-08T10:00:00Z") }],
};
const respondedAt = new Date("2026-09-08T12:00:00Z");
function database(documents = [doc]) {
  return {
    caseCheck: { findUniqueOrThrow: () => Promise.resolve({ caseId: 19n }) },
    document: { findMany: () => Promise.resolve(documents) },
  } as unknown as Prisma.TransactionClient;
}

void test("stale browser evidence selection cannot silently bind to a newer upload", async () => {
  await assert.rejects(
    captureMethodEvidence(
      database(),
      19n,
      [doc.publicId],
      [{ documentId: doc.publicId, version: 1 }],
    ),
    /changed after you opened/,
  );
  await assert.rejects(
    captureMethodEvidence(database(), 19n, [doc.publicId], []),
    /exact reviewed version/,
  );
  assert.deepEqual(
    await captureMethodEvidence(
      database(),
      19n,
      [doc.publicId],
      [{ documentId: doc.publicId, version: 2 }],
    ),
    [{ documentId: doc.publicId, version: 2 }],
  );
});

void test("method evidence parser supports historical IDs and immutable new versions", () => {
  assert.deepEqual(parseMethodEvidence('["document-one"]'), [
    { documentId: "document-one", version: null },
  ]);
  assert.deepEqual(
    parseMethodEvidence('[{"documentId":"document-one","version":2}]'),
    [{ documentId: "document-one", version: 2 }],
  );
  assert.throws(
    () => parseMethodEvidence('[{"documentId":"document-one","version":0}]'),
    /invalid/,
  );
  assert.throws(
    () => parseMethodEvidence('["document-one","document-one"]'),
    /invalid/,
  );
});

void test("a reviewed replacement cannot satisfy a source response for previous bytes", async () => {
  await assert.rejects(
    assertMethodEvidenceCurrent(database(), 1n, [
      {
        respondedAt,
        evidenceJson: '[{"documentId":"document-one","version":1}]',
      },
    ]),
    /Source evidence changed/,
  );
  await assertMethodEvidenceCurrent(database(), 1n, [
    {
      respondedAt,
      evidenceJson: '[{"documentId":"document-one","version":2}]',
    },
  ]);
});

void test("legacy source references reject newer files and missing evidence", async () => {
  await assertMethodEvidenceCurrent(database(), 1n, [
    { respondedAt, evidenceJson: '["document-one"]' },
  ]);
  await assert.rejects(
    assertMethodEvidenceCurrent(database(), 1n, [
      {
        respondedAt: new Date("2026-09-08T09:00:00Z"),
        evidenceJson: '["document-one"]',
      },
    ]),
    /Source evidence changed/,
  );
  await assert.rejects(
    assertMethodEvidenceCurrent(database([]), 1n, [
      {
        respondedAt,
        evidenceJson: '[{"documentId":"document-one","version":2}]',
      },
    ]),
    /Source evidence changed/,
  );
});

void test("new evidence snapshots use case-scoped reviewed unexpired documents", async () => {
  let query: unknown;
  const tx = {
    document: {
      findMany: (input: unknown) => {
        query = input;
        return Promise.resolve([doc]);
      },
    },
  } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await captureMethodEvidence(tx, 19n, ["document-one"]), [
    { documentId: "document-one", version: 2 },
  ]);
  assert.equal((query as { where: { caseId: bigint } }).where.caseId, 19n);
  await assert.rejects(
    captureMethodEvidence(database([]), 19n, ["foreign-document"]),
    /belong to this case/,
  );
});

void test("final QA and manager evidence gate rejects source results tied to replaced evidence", async () => {
  const tx = {
    verificationCase: { findUnique: () => Promise.resolve({ documents: [] }) },
    caseService: { findMany: () => Promise.resolve([]) },
    caseCheck: {
      findMany: () =>
        Promise.resolve([
          {
            id: 1n,
            type: "IDENTITY",
            result: "CLEAR",
            reviewCycle: 1,
            methodRuns: [
              {
                status: "RESPONDED",
                result: "CLEAR",
                respondedAt,
                evidenceJson: '[{"documentId":"document-one","version":1}]',
              },
            ],
          },
        ]),
    },
    document: { findMany: () => Promise.resolve([doc]) },
    clarification: { count: () => Promise.resolve(0) },
    fieldVisit: { count: () => Promise.resolve(0) },
  } as unknown as Prisma.TransactionClient;
  const readiness = await caseEvidenceReadiness(tx, 19n);
  assert.equal(readiness.ready, false);
  assert.ok(
    readiness.issues.some((issue) => issue.includes("Source evidence changed")),
  );
});
