import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import {
  physicalFieldIssues,
  fieldQaWhere,
} from "../src/field-visits/physical-field-policy";
import {
  caseEvidenceReadiness,
  assertCaseEvidenceReady,
} from "../src/documents/evidence-readiness";
import { QaReadinessService } from "../src/verification/qa-readiness.service";

const address = [{ type: "ADDRESS" }];
for (const status of [
  "MISSING",
  "ASSIGNED",
  "IN_PROGRESS",
  "REVIEW_PENDING",
  "EXCEPTION_REVIEW",
  "CANCELLED",
]) {
  void test(`physical Address blocks QA with ${status} field visit`, () => {
    assert.match(
      physicalFieldIssues(
        address,
        status === "MISSING" ? [] : [{ status }],
      ).join("; "),
      /Physical address verification required/,
    );
  });
}
void test("supervisor-approved physical visit satisfies Address, but another pending visit still blocks", () => {
  assert.deepEqual(physicalFieldIssues(address, [{ status: "COMPLETED" }]), []);
  assert.equal(
    physicalFieldIssues(address, [
      { status: "COMPLETED" },
      { status: "REVIEW_PENDING" },
    ]).length,
    1,
  );
  assert.deepEqual(physicalFieldIssues([{ type: "EDUCATION" }], []), []);
  assert.equal(
    physicalFieldIssues([{ type: "EDUCATION" }], [{ status: "ASSIGNED" }])
      .length,
    1,
  );
});

function scenario() {
  const visits: { status: string }[] = [];
  const writes: string[] = [];
  const tx = {
    verificationCase: {
      findUnique: () => ({
        documents: [],
        checks: address,
        fieldVisits: visits,
      }),
      update: () => ({}),
      updateMany: () => {
        writes.push("QA_REVIEW");
        return { count: 1 };
      },
    },
    caseService: { findMany: () => [] },
    caseCheck: { count: () => 0, findMany: () => [] },
    clarification: { count: () => 0 },
    caseStatusHistory: {
      create: () => {
        writes.push("history");
      },
    },
    outboxEvent: {
      create: () => {
        writes.push("outbox");
      },
    },
    user: { findMany: () => [] },
  } as unknown as Prisma.TransactionClient;
  return { tx, visits, writes };
}

void test("persisted legacy Address check is mandatory even without any field visit or service flag", async () => {
  const { tx } = scenario();
  const result = await caseEvidenceReadiness(tx, 1n);
  assert.equal(result.ready, false);
  await assert.rejects(
    () => assertCaseEvidenceReady(tx, 1n),
    /Physical address verification required/,
  );
});

void test("document-only readiness still allows starting verification before field work", async () => {
  const { tx } = scenario();
  assert.equal(
    (await caseEvidenceReadiness(tx, 1n, { includeWork: false })).ready,
    true,
  );
});

void test("last verifier completion waits for assignment, capture AND supervisor acceptance", async () => {
  const { tx, visits, writes } = scenario();
  const readiness = new QaReadinessService();
  const target = {
    tenantId: 1n,
    caseId: 1n,
    casePublicId: "case-1",
    changedById: 2n,
    fromStatus: "IN_PROGRESS" as const,
    reason: "Required field evidence accepted",
  };
  assert.equal(await readiness.promoteIfReady(tx, target), false);
  for (const status of [
    "ASSIGNED",
    "IN_PROGRESS",
    "REVIEW_PENDING",
    "EXCEPTION_REVIEW",
    "CANCELLED",
  ]) {
    visits.splice(0, visits.length, { status });
    assert.equal(await readiness.promoteIfReady(tx, target), false);
    assert.deepEqual(writes, []);
  }
  visits.splice(0, visits.length, { status: "COMPLETED" });
  assert.equal(await readiness.promoteIfReady(tx, target), true);
  assert.deepEqual(writes, ["QA_REVIEW", "history", "outbox"]);
});

void test("queue and claim SQL predicate explicitly requires completion for Address and excludes outstanding visits", () => {
  assert.deepEqual(fieldQaWhere(), {
    AND: [
      {
        OR: [
          { checks: { none: { type: "ADDRESS" } } },
          { fieldVisits: { some: { status: "COMPLETED" } } },
        ],
      },
      {
        fieldVisits: {
          none: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        },
      },
    ],
  });
});
