import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { dailySeries } from "../src/verification/task-insights.service";
import {
  taskAccessScope,
  taskSlaWhere,
} from "../src/verification/task-query.helpers";

const verifier: Actor = {
  userId: 42n,
  userPublicId: "00000000-0000-4000-8000-000000000042",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  branchId: 5n,
  email: "verifier@greencall.com",
  displayName: "Verifier",
  mustChangePassword: false,
  roles: ["VERIFIER"],
  permissions: ["task:read", "task:write"],
};

void test("verifier task access is tenant, assignee and branch scoped", () => {
  assert.deepEqual(taskAccessScope(verifier), {
    tenantId: 1n,
    assigneeId: 42n,
    check: { case: { branchId: 5n } },
  });
});

void test("task SLA filters keep completed work outside recovery queues", () => {
  const now = new Date(2026, 7, 31, 10, 0, 0);
  assert.deepEqual(taskSlaWhere("OVERDUE", now), {
    dueAt: { lt: now },
    status: { not: "COMPLETED" },
  });
  assert.deepEqual(taskSlaWhere("DUE_SOON", now), {
    dueAt: { gte: now, lte: new Date(2026, 8, 1, 10, 0, 0) },
    status: { not: "COMPLETED" },
  });
});

void test("verifier daily throughput returns a stable seven-day local series", () => {
  const firstDay = new Date(2026, 7, 25, 0, 0, 0);
  const values = [
    new Date(2026, 7, 25, 9, 30, 0),
    new Date(2026, 7, 25, 18, 0, 0),
    new Date(2026, 7, 31, 11, 0, 0),
  ];
  const result = dailySeries(values, firstDay);
  assert.equal(result.length, 7);
  assert.deepEqual(result[0], { date: "2026-08-25", completed: 2 });
  assert.deepEqual(result[6], { date: "2026-08-31", completed: 1 });
});
