import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { VendorQueueService } from "../src/vendor-checks/vendor-queue.service";
import { queueLocation } from "../src/vendor-checks/vendor-queue";
import {
  LIVE_VENDOR_STATUSES,
  OPEN_VENDOR_STATUSES,
} from "../src/vendor-checks/vendor-check-rules";

const vendorMain = {
  tenantId: 1n,
  userId: 50n,
  roles: ["VENDOR"],
  permissions: ["vendor:review"],
  displayName: "Fast Field Services",
} as unknown as Actor;
const vendorMember = {
  ...vendorMain,
  userId: 51n,
  vendorOwnerId: 50n,
  displayName: "Ravi (field)",
} as unknown as Actor;

type Row = Record<string, unknown>;

/** A fake database for one queued check; records every write. */
function queueDb(row: Row, options: { updateCount?: number } = {}) {
  const writes: Row[] = [];
  const audits: string[] = [];
  const notices: string[] = [];
  const costs: Row[] = [];
  const removedCosts: Row[] = [];
  const db = {
    vendorCheckAssignment: {
      findFirst: () => Promise.resolve(row),
      findMany: () => Promise.resolve([row]),
      updateMany: (args: { where: Row; data: Row }) => {
        writes.push(args.data);
        return Promise.resolve({ count: options.updateCount ?? 1 });
      },
    },
    vendorExtraCost: {
      create: (args: { data: Row }) => {
        costs.push(args.data);
        return Promise.resolve({ publicId: "cost-1", createdAt: new Date() });
      },
      deleteMany: (args: { where: Row }) => {
        removedCosts.push(args.where);
        return Promise.resolve({ count: 1 });
      },
    },
    document: {
      findMany: () =>
        Promise.resolve([{ publicId: "doc-1", type: "ADDRESS_PROOF" }]),
    },
    user: {
      findUnique: () => Promise.resolve({ displayName: "Fast Field Services" }),
      findMany: () => Promise.resolve([{ id: 50n }, { id: 60n }]),
    },
    notification: {
      create: (args: { data: { type: string } }) => {
        notices.push(args.data.type);
        return Promise.resolve({});
      },
      createMany: (args: { data: Array<{ type: string }> }) => {
        notices.push(...args.data.map((item) => item.type));
        return Promise.resolve({ count: args.data.length });
      },
    },
    auditEvent: {
      create: (args: { data: { action: string } }) => {
        audits.push(args.data.action);
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    ...db,
    $transaction: (work: (tx: typeof db) => Promise<unknown>) => work(db),
  } as unknown as PrismaService;
  return {
    service: new VendorQueueService(prisma),
    writes,
    audits,
    notices,
    costs,
    removedCosts,
  };
}

const openRow = {
  publicId: "job-1",
  version: 2,
  status: "OPEN",
  price: 450,
  city: "Lucknow",
  pincode: "226010",
  dueAt: new Date("2026-11-25T00:00:00Z"),
  note: "Visit between 10 and 6",
  createdAt: new Date("2026-11-17T00:00:00Z"),
  releaseCount: 1,
  sharedDocumentsJson: JSON.stringify(["doc-1"]),
  assignedById: 9n,
  check: { type: "ADDRESS" },
  case: { caseNumber: "SG-1" },
};

void test("the open queue shows the payment, city and documents, never the candidate", async () => {
  const { service } = queueDb(openRow);
  const result = await service.open(vendorMain, {});
  const [item] = result.items;
  assert.equal(item!.price, 450);
  assert.equal(item!.city, "Lucknow");
  assert.equal(item!.pincode, "226010");
  assert.deepEqual(item!.documents, ["ADDRESS_PROOF"]);
  assert.equal(item!.returnedTimes, 1);
  assert.equal(result.summary.value, 450);
  const shown = JSON.stringify(item);
  assert.doesNotMatch(shown, /SG-1|caseNumber|candidate|fullName/);
});

void test("picking gives the check to the vendor; a member who picks it works it", async () => {
  const main = queueDb(openRow);
  await main.service.pick(vendorMain, "job-1", 2);
  assert.equal(main.writes[0]!["vendorUserId"], 50n);
  assert.equal(main.writes[0]!["handlerUserId"], null);
  assert.equal(main.writes[0]!["status"], "IN_PROGRESS");
  assert.deepEqual(main.audits, ["vendor_check.picked"]);

  const member = queueDb(openRow);
  await member.service.pick(vendorMember, "job-1", 2);
  assert.equal(
    member.writes[0]!["vendorUserId"],
    50n,
    "the vendor company owns it",
  );
  assert.equal(member.writes[0]!["handlerUserId"], 51n);
});

void test("two vendors cannot both pick the same check", async () => {
  // The conditional update matched nothing: another vendor got there first.
  const late = queueDb(openRow, { updateCount: 0 });
  await assert.rejects(
    () => late.service.pick(vendorMain, "job-1", 2),
    /picked this check just now/,
  );
  const taken = queueDb({ ...openRow, status: "IN_PROGRESS" });
  await assert.rejects(
    () => taken.service.pick(vendorMain, "job-1", 2),
    ConflictException,
  );
});

const pickedRow = {
  id: 7n,
  publicId: "job-1",
  status: "IN_PROGRESS",
  version: 3,
  pickedAt: new Date("2026-11-17T10:00:00Z"),
  price: 450,
  city: "Lucknow",
  assignedById: 9n,
  handlerUserId: 51n,
  case: { caseNumber: "SG-1" },
  check: { type: "ADDRESS" },
  _count: { evidence: 0, extraCosts: 0 },
};

void test("a picked check goes back to the queue with a reason, for every vendor", async () => {
  const { service, writes, audits, notices, removedCosts } = queueDb(pickedRow);
  await assert.rejects(
    () => service.release(vendorMain, "job-1", { version: 3, reason: "far" }),
    BadRequestException,
  );
  await service.release(vendorMain, "job-1", {
    version: 3,
    reason: "Address is outside our service area",
  });
  assert.equal(writes[0]!["status"], "OPEN");
  assert.equal(writes[0]!["vendorUserId"], null);
  assert.deepEqual(writes[0]!["releaseCount"], { increment: 1 });
  assert.equal(removedCosts.length, 1, "unclaimed extra costs are dropped");
  assert.deepEqual(audits, ["vendor_check.released"]);
  assert.ok(notices.includes("VENDOR_QUEUE_NEW"), "vendors hear it is back");
});

void test("a check with proof, or sent to one vendor directly, cannot be returned", async () => {
  const withProof = queueDb({
    ...pickedRow,
    _count: { evidence: 1, extraCosts: 0 },
  });
  await assert.rejects(
    () =>
      withProof.service.release(vendorMain, "job-1", {
        version: 3,
        reason: "Changed our mind about it",
      }),
    /Remove the proof/,
  );
  const direct = queueDb({ ...pickedRow, pickedAt: null });
  await assert.rejects(
    () =>
      direct.service.release(vendorMain, "job-1", {
        version: 3,
        reason: "Changed our mind about it",
      }),
    /decline it instead/,
  );
});

void test("the vendor Team Leader approves a member's work or sends it back", async () => {
  const review = { ...pickedRow, status: "TEAM_REVIEW" };
  const member = queueDb(review);
  await assert.rejects(
    () =>
      member.service.teamReview(vendorMember, "job-1", {
        version: 3,
        decision: "APPROVE",
      }),
    ForbiddenException,
  );
  const approve = queueDb(review);
  await approve.service.teamReview(vendorMain, "job-1", {
    version: 3,
    decision: "APPROVE",
  });
  assert.equal(approve.writes[0]!["status"], "SUBMITTED");
  assert.equal(approve.writes[0]!["teamReviewedById"], 50n);
  assert.deepEqual(approve.audits, ["vendor_check.team-approved"]);

  const back = queueDb(review);
  await back.service.teamReview(vendorMain, "job-1", {
    version: 3,
    decision: "RETURN",
    note: "Add the neighbour's phone number",
  });
  assert.equal(back.writes[0]!["status"], "IN_PROGRESS");
  assert.ok(back.notices.includes("VENDOR_CHECK_RETURNED"));
});

void test("extra cost needs an amount and a reason, while the check is worked", async () => {
  const { service, costs, audits } = queueDb(pickedRow);
  await assert.rejects(
    () =>
      service.addExtraCost(vendorMember, "job-1", {
        amount: 0,
        reason: "Travelled far away",
      }),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      service.addExtraCost(vendorMember, "job-1", {
        amount: 300,
        reason: "far",
      }),
    BadRequestException,
  );
  const added = await service.addExtraCost(vendorMember, "job-1", {
    amount: 300,
    reason: "Travelled 40 km more: the address is outside the city",
  });
  assert.equal(added.status, "PENDING");
  assert.equal(costs[0]!["amount"], 300);
  assert.deepEqual(audits, ["vendor_check.extra-cost-added"]);
  const submitted = queueDb({ ...pickedRow, status: "SUBMITTED" });
  await assert.rejects(
    () =>
      submitted.service.addExtraCost(vendorMember, "job-1", {
        amount: 300,
        reason: "Travelled 40 km more than planned",
      }),
    ConflictException,
  );
});

void test("held and live statuses include the queue and the vendor's own review", () => {
  assert.ok(
    LIVE_VENDOR_STATUSES.includes("OPEN"),
    "a queued check blocks a second send",
  );
  assert.ok(
    !OPEN_VENDOR_STATUSES.includes("OPEN"),
    "nobody is reminded about the queue",
  );
  assert.ok(OPEN_VENDOR_STATUSES.includes("TEAM_REVIEW"));
});

void test("the queue shows only the city and pincode of the address", () => {
  assert.deepEqual(
    queueLocation(
      JSON.stringify({
        entries: [
          { address: "12 MG Road", city: "Lucknow", pincode: "226010" },
        ],
      }),
    ),
    { city: "Lucknow", pincode: "226010" },
  );
  assert.deepEqual(queueLocation(null), { city: null, pincode: null });
});
