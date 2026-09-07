import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { changeReservation } from "../src/qa/qa-reservation";

void test("QA reservation renewal is owner/version scoped and auditable", async () => {
  let where: Record<string, unknown> = {};
  let action = "";
  const tx = {
    verificationCase: {
      updateMany: (query: { where: Record<string, unknown> }) => {
        where = query.where;
        return Promise.resolve({ count: 1 });
      },
    },
    auditEvent: {
      create: (query: { data: { action: string } }) => {
        action = query.data.action;
        return Promise.resolve({});
      },
    },
  };
  const db = {
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  } as unknown as PrismaService;
  await changeReservation(
    db,
    { tenantId: 4n, userId: 3n, branchId: 2n } as Actor,
    "case-1",
    8,
    "renew",
  );
  assert.equal(where.tenantId, 4n);
  assert.equal(where.qaReviewerId, 3n);
  assert.equal(where.version, 8);
  assert.equal(where.branchId, 2n);
  assert.ok(where.qaClaimedAt);
  assert.equal(action, "qa.reservation-renewed");
});

void test("a stale or foreign reservation cannot be released or emit an audit event", async () => {
  let audited = false;
  const tx = {
    verificationCase: { updateMany: () => Promise.resolve({ count: 0 }) },
    auditEvent: {
      create: () => {
        audited = true;
        return Promise.resolve({});
      },
    },
  };
  const db = {
    $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
  } as unknown as PrismaService;
  await assert.rejects(
    changeReservation(
      db,
      { tenantId: 4n, userId: 3n } as Actor,
      "case-1",
      8,
      "release",
    ),
    /Reservation changed/,
  );
  assert.equal(audited, false);
});
