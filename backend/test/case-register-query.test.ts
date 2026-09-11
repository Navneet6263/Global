import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import {
  caseRegisterOrder,
  caseRegisterWhere,
} from "../src/cases/case-reader.service";
import { CaseQueryDto } from "../src/cases/dto/case-query.dto";

const actor: Actor = {
  userId: 10n,
  userPublicId: "00000000-0000-4000-8000-000000000010",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  email: "admin@saplingglobal.in",
  displayName: "Platform Admin",
  mustChangePassword: false,
  roles: ["PLATFORM_ADMIN"],
  permissions: ["*"],
};

void test("controlled release stages remain individually filterable", async () => {
  for (const [stage, status] of [
    ["manager_review", "MANAGER_REVIEW"],
    ["report_pending", "REPORT_PENDING"],
    ["payment_pending", "PAYMENT_PENDING"],
  ]) {
    const query = plainToInstance(CaseQueryDto, { stage });
    assert.equal((await validate(query)).length, 0);
    assert.deepEqual(caseRegisterWhere(actor, query).status, { in: [status] });
  }
});

void test("case register query validates page mode and server filters", async () => {
  const query = plainToInstance(CaseQueryDto, {
    page: "2",
    pageSize: "25",
    stage: "completed",
    priority: "URGENT",
    sla: "overdue",
    sortBy: "candidateName",
    sortDir: "asc",
  });
  assert.equal((await validate(query)).length, 0);
  assert.equal(query.page, 2);
  assert.equal(query.pageSize, 25);
});

void test("case register rejects unsupported client-side progress sorting", async () => {
  const query = plainToInstance(CaseQueryDto, { sortBy: "progress" });
  const errors = await validate(query);
  assert.equal(
    errors.some((error) => error.property === "rankedPage"),
    true,
  );
});

void test("case register where uses genuine stage, priority and SLA predicates", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");
  const query = plainToInstance(CaseQueryDto, {
    stage: "completed",
    priority: "URGENT",
    sla: "overdue",
  });
  const where = caseRegisterWhere(actor, query, now);
  assert.deepEqual(where.status, {
    in: ["COMPLETED", "CLOSED", "CANCELLED"],
  });
  assert.equal(where.priority, "URGENT");
  assert.deepEqual(where.AND, [{ dueAt: { lt: now } }]);
});

void test("case register sorting is stable and server-backed", () => {
  const query = plainToInstance(CaseQueryDto, {
    sortBy: "candidateName",
    sortDir: "asc",
  });
  assert.deepEqual(caseRegisterOrder(query), [
    { subject: { fullName: "asc" } },
    { publicId: "desc" },
  ]);
});

void test("operations ranked pages accept validated filters without losing branch restrictions", async () => {
  const query = plainToInstance(CaseQueryDto, {
    page: "2",
    pageSize: "10",
    sortBy: "priority",
    view: "operations",
    stage: "completed",
    ownerId: actor.userPublicId,
    risk: "high",
  });
  assert.equal((await validate(query)).length, 0);
  const where = caseRegisterWhere(
    { ...actor, roles: ["OPS_MANAGER"], branchId: 7n },
    query,
  );
  assert.equal(where.tenantId, 1n);
  assert.deepEqual(where.OR, [{ branchId: 7n }, { branchId: null }]);
  assert.deepEqual(where.AND, [
    { status: { in: ["COMPLETED", "CLOSED"] } },
    { riskLevel: { in: ["HIGH", "CRITICAL"] } },
    { assignedOpsUser: { publicId: actor.userPublicId } },
  ]);
});
