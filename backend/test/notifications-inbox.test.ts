import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import {
  categoryOf,
  categoryWhere,
} from "../src/notifications/notification-categories";
import { NotificationsService } from "../src/notifications/notifications.service";

const actor = {
  tenantId: 1n,
  userId: 5n,
  roles: ["VERIFIER"],
} as unknown as Actor;

void test("notification types fall into one inbox category each", () => {
  assert.equal(categoryOf("VENDOR_CHECK_OVERDUE"), "urgent");
  assert.equal(categoryOf("CASE_ESCALATED"), "urgent");
  assert.equal(categoryOf("QA_REWORK"), "review");
  assert.equal(categoryOf("FINAL_REVIEW_READY"), "review");
  assert.equal(categoryOf("INVOICE"), "finance");
  assert.equal(categoryOf("TASK_ASSIGNED"), "work");
  assert.equal(categoryOf("CHECK_SENT_BACK"), "work");
  assert.equal(categoryOf("ONBOARDING_SUBMITTED"), "other");
  // A later category excludes the earlier ones in the database filter too.
  assert.match(JSON.stringify(categoryWhere("work")), /"NOT"/);
});

void test("the inbox pages by cursor, filters unread and counts per category", async () => {
  const calls: unknown[] = [];
  const rows = Array.from({ length: 3 }, (_, index) => ({
    publicId: `n-${index}`,
    type: index === 0 ? "TASK_ASSIGNED" : "QA_READY",
    title: "Title",
    body: "Body",
    href: null,
    readAt: null,
    createdAt: new Date(2026, 9, 10 - index),
  }));
  const prisma = {
    notification: {
      findFirst: () => ({ id: 9n, createdAt: new Date(2026, 9, 11) }),
      findMany: (args: unknown) => {
        calls.push(args);
        return rows;
      },
      count: () => 4,
      groupBy: (args: { where: { readAt?: null } }) =>
        args.where.readAt === null
          ? [{ type: "QA_READY", _count: { _all: 2 } }]
          : [
              { type: "TASK_ASSIGNED", _count: { _all: 3 } },
              { type: "QA_READY", _count: { _all: 5 } },
            ],
    },
  } as unknown as PrismaService;
  const page = await new NotificationsService(prisma).list(actor, {
    limit: 2,
    unread: true,
    category: "review",
    cursor: "00000000-0000-4000-8000-000000000001",
  });
  assert.equal(page.items.length, 2);
  assert.equal(page.nextCursor, "n-1");
  assert.equal(page.items[0]!.category, "work");
  assert.deepEqual(page.counts.review, { total: 5, unread: 2 });
  assert.deepEqual(page.counts.work, { total: 3, unread: 0 });
  assert.equal(page.total, 8);
  const where = JSON.stringify(calls[0], (_, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  assert.match(where, /"readAt":null/);
  assert.match(where, /"lt"/);
  assert.match(where, /"startsWith":"QA_"/);
});
