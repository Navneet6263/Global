import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { OperationsActionsService } from "../src/dashboards/operations-actions.service";
import { OperationsActionsController } from "../src/dashboards/operations-actions.controller";
import { OperationsActionQueryDto } from "../src/dashboards/dto/operations-action-query.dto";
import {
  operationsActionScope,
  operationsWorkItems,
} from "../src/dashboards/operations-action-query";

const actor = {
  tenantId: 1n,
  branchId: 2n,
  clientId: 3n,
  roles: ["OPS_MANAGER"],
} as Actor;

void test("inbox scopes parameterize tenant and respect branch/client restrictions", () => {
  const scope = operationsActionScope(actor);
  assert.deepEqual(scope.values, [1n, 2n, 3n]);
  assert.match(scope.sql, /branchId\] IS NULL/);
  const admin = operationsActionScope({ ...actor, roles: ["PLATFORM_ADMIN"] });
  assert.deepEqual(admin.values, [1n]);
  assert.doesNotMatch(admin.sql, /branchId|clientId/);
});

void test("summary counts are independent of page and search; stale page is clamped", async () => {
  const queries: Prisma.Sql[] = [];
  const needle = "name%' OR 1=1--";
  const db = {
    $queryRaw: (sql: Prisma.Sql) => {
      queries.push(sql);
      if (queries.length === 1)
        return [{ action: "documents", cases: 90, quantity: 120 }];
      if (queries.length === 2) return [{ total: 9 }];
      return [{ id: "case-9", quantity: 2 }];
    },
  } as unknown as PrismaService;
  const result = await new OperationsActionsService(db).get(actor, {
    action: "documents",
    search: needle,
    page: 100,
    pageSize: 8,
  });
  assert.equal(result.summary[0].cases, 90);
  assert.equal(result.summary[0].quantity, 120);
  assert.equal(result.summary.length, 6);
  assert.equal(result.total, 9);
  assert.equal(result.page, 2);
  assert.equal(result.items.length, 1);
  assert.ok(!queries[0].values.includes(needle));
  assert.ok(queries[1].values.includes(needle));
  assert.ok(!queries[1].sql.includes(needle));
  assert.deepEqual(queries[2].values.slice(-2), [8, 8]);
});

void test("empty queue is real zero rather than a fabricated card count", async () => {
  const db = { $queryRaw: () => [] } as unknown as PrismaService;
  const result = await new OperationsActionsService(db).get(
    actor,
    new OperationsActionQueryDto(),
  );
  assert.ok(result.summary.every((entry) => entry.cases === 0));
  assert.equal(result.page, 1);
  assert.equal(result.total, 0);
});

void test("route and service deny other workspaces, and validate query bounds", async () => {
  assert.deepEqual(Reflect.getMetadata("roles", OperationsActionsController), [
    "PLATFORM_ADMIN",
    "OPS_MANAGER",
  ]);
  assert.deepEqual(
    Reflect.getMetadata("permissions", OperationsActionsController),
    ["dashboard:read", "case:read"],
  );
  const service = new OperationsActionsService({} as PrismaService);
  await assert.rejects(
    service.get(
      { ...actor, roles: ["CLIENT_ADMIN"] },
      new OperationsActionQueryDto(),
    ),
    /Only operations/,
  );
  assert.equal(
    validateSync(
      plainToInstance(OperationsActionQueryDto, {
        action: "field_review",
        page: "2",
        pageSize: "8",
      }),
    ).length,
    0,
  );
  assert.equal(
    validateSync(
      plainToInstance(OperationsActionQueryDto, {
        action: "arbitrary",
        page: 0,
        pageSize: 999,
      }),
    ).length,
    3,
  );
});

void test("work predicates include clean latest uploads, physical requirements, responses and existing intake gates", () => {
  const sql = operationsWorkItems(actor, new Date("2026-09-10T12:00:00Z")).sql;
  for (const token of [
    "OPENJSON",
    "ACCEPTED",
    "VERIFIED",
    "CLEAN",
    "RESPONDED",
    "ADDRESS",
    "REVIEW_PENDING",
    "EXCEPTION_REVIEW",
    "CANCELLED",
    "expiresAt",
    "currentVersion",
  ])
    assert.ok(sql.includes(token), token);
  assert.doesNotMatch(sql, /UPDATE |DELETE |INSERT /);
});
