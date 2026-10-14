import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException } from "@nestjs/common";
import { ClarificationsController } from "../src/clarifications/clarifications.controller";
import type { ClarificationTokenService } from "../src/clarifications/clarification-token.service";
import { ClarificationsService } from "../src/clarifications/clarifications.service";
import { Permission } from "../src/common/auth/permissions";
import type { PrismaService } from "../src/database/prisma.service";
import { QaReadinessService } from "../src/verification/qa-readiness.service";
import { passesGuard } from "./helpers/guard-check";
import { testActor } from "./helpers/test-actor";

const rm = testActor(["SPOC_RM"], [Permission.CaseRead, Permission.ClarificationRead]);
const verifier = testActor(["VERIFIER"], [Permission.ClarificationWrite]);

void test("the RM has its own insufficiency route; others keep theirs", () => {
  assert.ok(passesGuard(ClarificationsController, "raiseAsRm", rm));
  // The RM role holds no clarification:write, so the general route stays closed to it.
  assert.ok(!passesGuard(ClarificationsController, "create", rm));
  assert.ok(!passesGuard(ClarificationsController, "raiseAsRm", verifier));
  assert.ok(passesGuard(ClarificationsController, "create", verifier));
});

/** Reaching the write transaction proves every rule before it let the raise through. */
const REACHED = new Error("reached the insufficiency write");

function service(caseRow: object | null) {
  const seen: unknown[] = [];
  const prisma = {
    verificationCase: {
      findFirst: (input: unknown) => {
        seen.push(input);
        return Promise.resolve(caseRow);
      },
    },
    $transaction: () => Promise.reject(REACHED),
  };
  return {
    seen,
    service: new ClarificationsService(
      prisma as unknown as PrismaService,
      {} as ClarificationTokenService,
      new QaReadinessService(),
    ),
  };
}

const inVerification = {
  id: 9n,
  status: "IN_PROGRESS",
  workflowVersion: 2,
  intakeStage: "ROUTED",
  dataEntryUserId: null,
};
const input = { subject: "Relieving letter", message: "Please upload the relieving letter" };

void test("the RM raises L2 during verification on its own clients' cases", async () => {
  const { service: clarifications, seen } = service(inVerification);
  await assert.rejects(
    clarifications.create(
      testActor(["SPOC_RM"], [], { spocClients: [{ id: 40n } as never] }),
      "00000000-0000-4000-8000-000000000009",
      input,
    ),
    REACHED,
  );
  // The case is looked up inside the RM's client scope.
  assert.match(JSON.stringify(seen[0], (_k, v: unknown) => (typeof v === "bigint" ? `${v}` : v)), /"clientId":\{"in":\["40"\]\}/);
});

void test("an RM who also does Data Entry may still raise L2; plain Data Entry may not", async () => {
  await assert.rejects(
    service(inVerification).service.create(
      testActor(["SPOC_RM", "DATA_ENTRY"], []),
      "00000000-0000-4000-8000-000000000009",
      input,
    ),
    REACHED,
  );
  await assert.rejects(
    service(inVerification).service.create(
      testActor(["DATA_ENTRY"], []),
      "00000000-0000-4000-8000-000000000009",
      input,
    ),
    (error: unknown) =>
      error instanceof ConflictException && /only while the case is under Data Entry/.test(error.message),
  );
});

void test("a case outside the RM's companies cannot be found", async () => {
  await assert.rejects(
    service(null).service.create(rm, "00000000-0000-4000-8000-000000000009", input),
    /Case not found/,
  );
});
