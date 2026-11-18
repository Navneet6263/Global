import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { ContentInspectionService } from "../src/documents/content-inspection.service";
import type { DocumentsService } from "../src/documents/documents.service";
import type { LocalObjectStorageService } from "../src/documents/local-object-storage.service";
import {
  earningsFor,
  inReviewValue,
  istMonth,
  istMonthRange,
} from "../src/vendor-checks/vendor-earnings";
import { VendorWorkService } from "../src/vendor-checks/vendor-work.service";

void test("months follow India time", () => {
  // 18:40 UTC on 31 Oct is already 1 Nov in India.
  assert.equal(istMonth(new Date("2026-10-31T18:40:00Z")), "2026-11");
  assert.equal(istMonth(new Date("2026-10-31T18:00:00Z")), "2026-10");
  const range = istMonthRange("2026-11")!;
  assert.equal(range.from.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(range.to.toISOString(), "2026-11-30T18:30:00.000Z");
  assert.equal(
    istMonthRange("2026-12")!.to.toISOString(),
    "2026-12-31T18:30:00.000Z",
  );
  assert.equal(istMonthRange("2026-13"), null);
  assert.equal(istMonthRange("26-11"), null);
});

const row = (
  overrides: Partial<Parameters<typeof earningsFor>[0][number]> = {},
) => ({
  id: "job-1",
  caseNumber: "SG-1",
  checkType: "ADDRESS",
  city: "Lucknow",
  pincode: "226010",
  handler: { name: "Ravi" },
  reviewedAt: new Date("2026-11-10T06:00:00Z"),
  price: 450,
  fromQueue: true,
  extraCosts: [
    { amount: 200, status: "APPROVED" },
    { amount: 90, status: "REJECTED" },
    { amount: 50, status: "PENDING" },
  ],
  ...overrides,
});

void test("earnings count the payment plus approved extra cost only", () => {
  const result = earningsFor([
    row(),
    row({ id: "job-2", price: null, fromQueue: false, extraCosts: [] }),
  ]);
  assert.equal(result.items[0]!.payment, 450);
  assert.equal(result.items[0]!.extra, 200);
  assert.equal(result.items[0]!.total, 650);
  assert.equal(result.items[0]!.handledBy, "Ravi");
  assert.equal(result.items[1]!.rateToConfirm, true);
  assert.deepEqual(result.totals, {
    checks: 2,
    payment: 450,
    extra: 200,
    total: 650,
    rateToConfirm: 1,
  });
});

void test("work in review counts payment and every cost not rejected", () => {
  assert.deepEqual(
    inReviewValue([
      { price: 300, extraCosts: [{ amount: 100, status: "PENDING" }] },
      { price: null, extraCosts: [{ amount: 40, status: "REJECTED" }] },
    ]),
    { checks: 2, value: 400 },
  );
});

void test("the earnings query is scoped to the vendor, accepted checks and the IST month", async () => {
  const calls: Array<{ where: Record<string, unknown> }> = [];
  const prisma = {
    vendorCheckAssignment: {
      findMany: (args: { where: Record<string, unknown> }) => {
        calls.push(args);
        return [];
      },
    },
  } as unknown as PrismaService;
  const service = new VendorWorkService(
    prisma,
    {} as LocalObjectStorageService,
    {} as ContentInspectionService,
    {} as DocumentsService,
  );
  const member = {
    tenantId: 1n,
    userId: 61n,
    vendorOwnerId: 50n,
    roles: ["VENDOR"],
  } as Actor;
  const result = await service.earnings(member, "2026-11");
  assert.equal(result.month, "2026-11");
  assert.deepEqual(result.totals.checks, 0);
  const accepted = calls[0]!.where;
  assert.equal(accepted.status, "APPROVED");
  assert.equal(accepted.vendorUserId, 50n);
  assert.equal(accepted.handlerUserId, 61n);
  assert.deepEqual(accepted.reviewedAt, {
    gte: new Date("2026-10-31T18:30:00.000Z"),
    lt: new Date("2026-11-30T18:30:00.000Z"),
  });
  assert.deepEqual(calls[1]!.where.status, {
    in: ["SUBMITTED", "TEAM_REVIEW"],
  });
  await assert.rejects(service.earnings(member, "2026-13"), /2026-11/);
  await assert.rejects(
    service.earnings({
      tenantId: 1n,
      userId: 2n,
      roles: ["OPS_MANAGER"],
    } as Actor),
    /Vendor access/,
  );
});
