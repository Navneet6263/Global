import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "../src/generated/prisma/client";
import {
  assertCheckReady,
  checkReadinessGaps,
} from "../src/verification/check-readiness";

const tx = (row: {
  verifiedJson: string | null;
  evidence?: number;
  vendorApproved?: boolean;
}) =>
  ({
    caseCheck: {
      findUniqueOrThrow: () => ({
        verifiedJson: row.verifiedJson,
        _count: { evidence: row.evidence ?? 0 },
        vendorWork: row.vendorApproved ? [{ id: 1n }] : [],
      }),
    },
  }) as unknown as Pick<Prisma.TransactionClient, "caseCheck">;

const identity = { id: 1n, type: "IDENTITY" };
const verified = JSON.stringify({
  entries: [
    {
      idType: "Aadhaar",
      idNumber: "123412341234",
      nameMatch: "Yes",
      method: "Government API",
      verificationDate: "2026-10-09",
    },
  ],
});
const summary = "Aadhaar verified on the UIDAI portal; name matches.";

void test("a check with nothing filled in cannot be completed", async () => {
  const gaps = await checkReadinessGaps(
    tx({ verifiedJson: null }),
    identity,
    "",
  );
  assert.equal(gaps.length, 3);
  await assert.rejects(
    assertCheckReady(tx({ verifiedJson: null }), identity, "short"),
    /cannot be completed yet\. 1\) Save the verified details/,
  );
});

void test("verified details must pass the form's required fields", async () => {
  const gaps = await checkReadinessGaps(
    tx({
      verifiedJson: JSON.stringify({ entries: [{ idType: "Aadhaar" }] }),
      evidence: 1,
    }),
    identity,
    summary,
  );
  assert.deepEqual(gaps.length, 1);
  assert.match(gaps[0]!, /ID number \(confirmed\) is required/);
});

void test("proof is a verifier upload or an approved vendor result", async () => {
  assert.match(
    (
      await checkReadinessGaps(
        tx({ verifiedJson: verified }),
        identity,
        summary,
      )
    )[0]!,
    /at least one proof file/,
  );
  assert.deepEqual(
    await checkReadinessGaps(
      tx({ verifiedJson: verified, vendorApproved: true }),
      identity,
      summary,
    ),
    [],
  );
  await assertCheckReady(
    tx({ verifiedJson: verified, evidence: 2 }),
    identity,
    summary,
  );
});
