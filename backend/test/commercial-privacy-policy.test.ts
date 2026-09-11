import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ROLES_KEY, PERMISSIONS_KEY } from "../src/common/auth/auth.decorators";
import { Prisma } from "../src/generated/prisma/client";
import { assertClientActivation } from "../src/clients/client-activation.policy";
import { ClientAgreementFilesController } from "../src/clients/client-agreement-files.controller";
import { RetentionPreviewController } from "../src/privacy/retention-preview.controller";
import {
  assertSharingDecision,
  VendorSharingController,
} from "../src/privacy/vendor-sharing.controller";
import {
  CreditControlController,
  CreditControlDto,
  creditBalance,
} from "../src/finance/credit-control.controller";
import { collectionNotice } from "../src/outbox/commercial-reminder.service";

const now = new Date("2026-09-09T12:00:00Z");
const past = new Date("2026-09-08T12:00:00Z");
const future = new Date("2026-09-20T12:00:00Z");

void test("new client activation requires the latest independently reviewed originals", () => {
  const row = {
    billingAddress: "Office address",
    billingTerms: "15 days",
    packageRates: [{ active: true }],
    agreements: ["AGREEMENT", "DPA"].map((type) => ({
      type,
      signedAt: past,
      expiresAt: future,
      files: [{ status: "APPROVED" }],
    })),
  };
  assert.doesNotThrow(() => assertClientActivation(row, now));
  for (const files of [
    undefined,
    [],
    [{ status: "PENDING" }, { status: "APPROVED" }],
    [{ status: "REJECTED" }],
  ])
    assert.throws(
      () =>
        assertClientActivation(
          {
            ...row,
            agreements: row.agreements.map((agreement) => ({
              ...agreement,
              files,
            })),
          },
          now,
        ),
      /independently approved file/,
    );
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, ClientAgreementFilesController),
    ["PLATFORM_ADMIN", "SALES_MANAGER"],
  );
});
void test("retention holds and vendor sharing are admin-only management capabilities", () => {
  for (const controller of [
    RetentionPreviewController,
    VendorSharingController,
  ]) {
    assert.deepEqual(Reflect.getMetadata(ROLES_KEY, controller), [
      "PLATFORM_ADMIN",
    ]);
    assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, controller), [
      "settings:manage",
    ]);
  }
});
void test("vendor authority needs independent unexpired approval and controlled revocation", () => {
  const row = { status: "PROPOSED", expiresAt: future, createdById: 1n };
  assert.throws(
    () => assertSharingDecision(row, "AUTHORISED", 1n, now),
    /different/,
  );
  assert.throws(
    () =>
      assertSharingDecision({ ...row, expiresAt: past }, "AUTHORISED", 2n, now),
    /unexpired/,
  );
  assert.doesNotThrow(() => assertSharingDecision(row, "AUTHORISED", 2n, now));
  assert.doesNotThrow(() =>
    assertSharingDecision({ ...row, status: "AUTHORISED" }, "REVOKED", 1n, now),
  );
  assert.throws(
    () =>
      assertSharingDecision(
        { ...row, status: "REVOKED" },
        "AUTHORISED",
        2n,
        now,
      ),
    /not available/,
  );
});
void test("credit controls are finance-only and distinguish missing vs cleared limits", async () => {
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, CreditControlController), [
    "PLATFORM_ADMIN",
    "FINANCE_MANAGER",
  ]);
  const input = {
    version: 1,
    creditHold: false,
    reason: "Credit decision reviewed",
  };
  assert.ok(
    (await validate(plainToInstance(CreditControlDto, input))).some(
      (x) => x.property === "creditLimit",
    ),
  );
  assert.equal(
    (
      await validate(
        plainToInstance(CreditControlDto, { ...input, creditLimit: null }),
      )
    ).length,
    0,
  );
  assert.ok(
    (
      await validate(
        plainToInstance(CreditControlDto, { ...input, creditLimit: -1 }),
      )
    ).length,
  );
  assert.equal(
    creditBalance({
      totalAmount: new Prisma.Decimal("99999999999999.99"),
      paidAmount: new Prisma.Decimal("0.02"),
      creditedAmount: new Prisma.Decimal("0.01"),
    }).toFixed(2),
    "99999999999999.96",
  );
});
void test("collections escalate at 7 and 30 overdue days without changing payment state", () => {
  assert.equal(collectionNotice(0).type, "COLLECTION_OVERDUE");
  assert.equal(collectionNotice(7).type, "COLLECTION_FOLLOW_UP");
  assert.equal(collectionNotice(30).managers, true);
});
