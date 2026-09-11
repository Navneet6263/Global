import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import {
  assertMethodOutcomesReady,
  consolidatedMethodResult,
} from "../src/verification/method-outcome.policy";

function database(
  runs: Array<{ status: string; result: string | null }>,
  clarified = 0,
) {
  return {
    verificationMethodRun: {
      findMany: () =>
        Promise.resolve(
          runs.map((run) => ({
            ...run,
            evidenceJson: "[]",
            respondedAt: new Date(),
          })),
        ),
    },
    caseCheck: {
      findUniqueOrThrow: () => Promise.resolve({ caseId: 17n, reviewCycle: 1 }),
    },
    clarification: { count: () => Promise.resolve(clarified) },
  } as unknown as Prisma.TransactionClient;
}

void test("multiple methods are independent inputs, not a mandatory sequential pipeline", async () => {
  await assertMethodOutcomesReady(
    database([
      { status: "RESPONDED", result: "CLEAR" },
      { status: "RESPONDED", result: "CLEAR" },
    ]),
    2n,
    "CLEAR",
  );
  await assertMethodOutcomesReady(database([]), 2n, "CLEAR");
});

void test("an outstanding source response blocks completion", async () => {
  await assert.rejects(
    assertMethodOutcomesReady(
      database([
        { status: "RESPONDED", result: "CLEAR" },
        { status: "REQUESTED", result: null },
      ]),
      2n,
      "CLEAR",
    ),
    /outstanding source-method/,
  );
});

void test("conflicting method outcomes cannot be silently marked clear", async () => {
  const runs = [
    { status: "RESPONDED", result: "CLEAR" },
    { status: "RESPONDED", result: "DISCREPANCY" },
  ];
  await assert.rejects(
    assertMethodOutcomesReady(database(runs, 1), 2n, "CLEAR"),
    /reflect the recorded source results/,
  );
  await assert.rejects(
    assertMethodOutcomesReady(database(runs), 2n, "DISCREPANCY"),
    /clarification/,
  );
  await assertMethodOutcomesReady(database(runs, 1), 2n, "DISCREPANCY");
});

void test("inconclusive manual checks also require an opportunity to clarify", async () => {
  await assert.rejects(
    assertMethodOutcomesReady(database([]), 2n, "UNABLE_TO_VERIFY"),
    /clarification/,
  );
  assert.equal(
    consolidatedMethodResult(["CLEAR", "UNABLE_TO_VERIFY"]),
    "UNABLE_TO_VERIFY",
  );
});

void test("a reopened check cannot reuse a previous cycle clarification", async () => {
  let query: unknown;
  const tx = {
    verificationMethodRun: { findMany: () => Promise.resolve([]) },
    caseCheck: {
      findUniqueOrThrow: () => Promise.resolve({ caseId: 17n, reviewCycle: 2 }),
    },
    clarification: {
      count: (input: unknown) => {
        query = input;
        return Promise.resolve(0);
      },
    },
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(
    assertMethodOutcomesReady(tx, 2n, "DISCREPANCY"),
    /clarification/,
  );
  assert.deepEqual(query, {
    where: {
      caseId: 17n,
      checkId: 2n,
      status: "RESOLVED",
      reverificationRequired: true,
      OR: [{ checkCycle: 2 }],
    },
  });
});
