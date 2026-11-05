import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { decideQaCase } from "../src/qa/qa-decision";
import { cleanVerified } from "../src/verification/verified-fields";
import type { QaDecisionDto } from "../src/qa/dto/qa-decision.dto";

const DOC = "11111111-1111-4111-8111-111111111111";
const qa = {
  tenantId: 1n,
  userId: 7n,
  roles: ["QA_REVIEWER"],
} as unknown as Actor;
const PASSED = new Error("validation passed");

function prisma() {
  return {
    verificationCase: {
      findFirst: () =>
        Promise.resolve({
          id: 30n,
          status: "QA_REVIEW",
          version: 5,
          qaReviewerId: 7n,
          qaClaimedAt: new Date(),
          documents: [{ publicId: DOC, type: "AADHAAR", currentVersion: 1 }],
          checks: [
            {
              id: 1n,
              publicId: "c1",
              status: "COMPLETED",
              findings: [],
              tasks: [{ completedById: 9n }],
            },
          ],
        }),
    },
    // Reaching the write means every rule before it passed.
    $transaction: () => Promise.reject(PASSED),
  } as unknown as PrismaService;
}

const decision = (extra: Partial<QaDecisionDto>): QaDecisionDto => ({
  decision: "APPROVED",
  caseVersion: 5,
  notes: "Every check and document reviewed independently.",
  checklist: [],
  documentComments: [],
  reworkCheckIds: [],
  ...extra,
});

void test("QA approves only after commenting on every uploaded document", async () => {
  await assert.rejects(
    decideQaCase(prisma(), qa, "case-1", decision({})),
    (error: unknown) =>
      error instanceof BadRequestException &&
      /Comment on every document before approving: aadhaar/.test(error.message),
  );
  await assert.rejects(
    decideQaCase(
      prisma(),
      qa,
      "case-1",
      decision({
        documentComments: [{ documentId: DOC, comment: "Clear copy; matches" }],
      }),
    ),
    (error: unknown) => error === PASSED,
  );
  // The checklist is no longer needed, and a rework needs no comments.
  await assert.rejects(
    decideQaCase(
      prisma(),
      qa,
      "case-1",
      decision({ decision: "REWORK", reworkCheckIds: [] }),
    ),
    /Choose at least one check for rework/,
  );
});

void test("an online education check records the source link, not a referee", () => {
  const online = {
    method: "Online portal",
    onlineSource: "https://results.example.edu/verify/123",
    institute: "Pune University",
    verified: "Yes",
    verificationDate: "2026-11-05",
    verifierName: "Typed by mistake",
  };
  const [saved] = cleanVerified("EDUCATION", [online]);
  assert.equal(saved!.onlineSource, online.onlineSource);
  assert.equal("verifierName" in saved!, false);
  assert.throws(
    () => cleanVerified("EDUCATION", [{ ...online, onlineSource: "" }]),
    /Online source \(link\) is required/,
  );
  // By email: the referee stays, the link does not apply.
  const [email] = cleanVerified("EDUCATION", [{ ...online, method: "Email" }]);
  assert.equal(email!.verifierName, "Typed by mistake");
  assert.equal("onlineSource" in email!, false);
});
