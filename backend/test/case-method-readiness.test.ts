import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import { caseMethodIssues } from "../src/verification/case-method-readiness";
import type { MethodEvidenceDocument } from "../src/verification/method-evidence.policy";

const document: MethodEvidenceDocument = {
  publicId: "evidence",
  status: "VERIFIED",
  currentVersion: 1,
  expiresAt: null,
  versions: [{ version: 1, createdAt: new Date("2025-01-01") }],
};
const run = {
  status: "RESPONDED",
  result: "DISCREPANCY",
  respondedAt: new Date("2025-02-01"),
  evidenceJson: '[{"documentId":"evidence","version":1}]',
};
const check = {
  id: 1n,
  type: "IDENTITY",
  result: "DISCREPANCY",
  reviewCycle: 1,
  methodRuns: [run],
};

function fixture(
  checks = [check],
  documents = [document],
  clarifications: Array<{ checkId: bigint; checkCycle: number | null }> = [
    { checkId: 1n, checkCycle: 1 },
  ],
) {
  const calls: Array<{ name: string; input: unknown }> = [];
  const tx = {
    caseCheck: {
      findMany: (input: unknown) => {
        calls.push({ name: "checks", input });
        return Promise.resolve(checks);
      },
    },
    document: {
      findMany: (input: unknown) => {
        calls.push({ name: "documents", input });
        return Promise.resolve(documents);
      },
    },
    clarification: {
      findMany: (input: unknown) => {
        calls.push({ name: "clarifications", input });
        return Promise.resolve(clarifications);
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, calls };
}

void test("one or 84 completed method checks use the same three grouped query calls", async () => {
  for (const count of [1, 84]) {
    const checks = Array.from({ length: count }, (_, index) => ({
      ...check,
      id: BigInt(index + 1),
    }));
    const clarified = checks.map((item) => ({
      checkId: item.id,
      checkCycle: item.reviewCycle,
    }));
    const f = fixture(checks, [document], clarified);
    assert.deepEqual(await caseMethodIssues(f.tx, 99n), []);
    assert.deepEqual(
      f.calls.map((item) => item.name),
      ["checks", "documents", "clarifications"],
    );
    assert.deepEqual((f.calls[0]?.input as { where: unknown }).where, {
      caseId: 99n,
      status: "COMPLETED",
      methodRuns: { some: { status: { not: "SUPERSEDED" } } },
    });
    assert.deepEqual((f.calls[1]?.input as { where: unknown }).where, {
      caseId: 99n,
    });
    assert.equal(
      (f.calls[2]?.input as { where: { caseId: bigint } }).where.caseId,
      99n,
    );
  }
});

void test("batched gate preserves outcome conflict, source response and evidence failures", async () => {
  const incomplete = fixture([
    { ...check, methodRuns: [{ ...run, status: "REQUESTED" }] },
  ]);
  assert.match(
    (await caseMethodIssues(incomplete.tx, 99n))[0]!,
    /outstanding source-method/,
  );
  const conflict = fixture([{ ...check, result: "CLEAR" }]);
  assert.match(
    (await caseMethodIssues(conflict.tx, 99n))[0]!,
    /reflect the recorded source results/,
  );
  const changed = fixture(
    [check],
    [
      {
        ...document,
        currentVersion: 2,
        versions: [{ ...document.versions[0]!, version: 2 }],
      },
    ],
  );
  assert.match(
    (await caseMethodIssues(changed.tx, 99n))[0]!,
    /Source evidence changed/,
  );
  const expired = fixture(
    [check],
    [{ ...document, expiresAt: new Date("2020-01-01") }],
  );
  assert.match((await caseMethodIssues(expired.tx, 99n))[0]!, /expired/);
  const malformed = fixture([
    { ...check, methodRuns: [{ ...run, evidenceJson: "not-json" }] },
  ]);
  assert.match(
    (await caseMethodIssues(malformed.tx, 99n))[0]!,
    /evidence record is invalid/,
  );
});

void test("batched clarification matching cannot borrow another check or old review cycle", async () => {
  const previousCycle = fixture([{ ...check, reviewCycle: 2 }]);
  assert.match(
    (await caseMethodIssues(previousCycle.tx, 99n))[0]!,
    /Record a clarification/,
  );
  const otherCheck = fixture(
    [check],
    [document],
    [{ checkId: 2n, checkCycle: 1 }],
  );
  assert.match(
    (await caseMethodIssues(otherCheck.tx, 99n))[0]!,
    /Record a clarification/,
  );
  const legacyCycle = fixture(
    [check],
    [document],
    [{ checkId: 1n, checkCycle: null }],
  );
  assert.deepEqual(await caseMethodIssues(legacyCycle.tx, 99n), []);
  const legacyWrongCycle = fixture(
    [{ ...check, reviewCycle: 2 }],
    [document],
    [{ checkId: 1n, checkCycle: null }],
  );
  assert.match(
    (await caseMethodIssues(legacyWrongCycle.tx, 99n))[0]!,
    /Record a clarification/,
  );
});

void test("legacy no-method completed cases incur no source or clarification reads", async () => {
  const f = fixture([]);
  assert.deepEqual(await caseMethodIssues(f.tx, 99n), []);
  assert.deepEqual(
    f.calls.map((item) => item.name),
    ["checks"],
  );
});
