import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { Prisma } from "../src/generated/prisma/client";
import { CaseActivityService } from "../src/cases/case-activity.service";

const actor = {
  tenantId: 1n,
  userId: 2n,
  roles: ["OPS_MANAGER"],
  branchId: 3n,
} as Actor;

void test("clients and verifiers cannot read operational case activity", async () => {
  const service = new CaseActivityService({} as PrismaService);
  for (const role of [
    "CLIENT_ADMIN",
    "VERIFIER",
    "QA_REVIEWER",
    "FIELD_EXECUTIVE",
  ]) {
    await assert.rejects(
      service.list({ ...actor, roles: [role] }, "case", { limit: 15 }),
      /operations managers and platform administrators/,
    );
  }
});

void test("case activity authorizes tenant/branch before reading audit records", async () => {
  let lookup: unknown;
  const prisma = {
    verificationCase: {
      findFirst: (input: unknown) => {
        lookup = input;
        return null;
      },
    },
    $queryRaw: () =>
      assert.fail("No audit query may run for an inaccessible case"),
  } as unknown as PrismaService;
  await assert.rejects(
    new CaseActivityService(prisma).list(actor, "case-id", { limit: 15 }),
    /Case not found/,
  );
  assert.deepEqual(lookup, {
    where: {
      tenantId: 1n,
      OR: [{ branchId: 3n }, { branchId: null }],
      publicId: "case-id",
    },
    select: { id: true },
  });
});

void test("paginated activity keeps parameters bound and returns only allowlisted metadata", async () => {
  let statement: Prisma.Sql | undefined;
  const malicious = "report'; DROP TABLE AuditEvent;--";
  const row = {
    id: "event-1",
    action: "report.downloaded",
    resourceType: "report",
    actorName: "Reviewer",
    createdAt: new Date(),
  };
  const prisma = {
    verificationCase: { findFirst: () => ({ id: 4n }) },
    $queryRaw: (sql: Prisma.Sql) => {
      statement = sql;
      return [
        {
          ...row,
          afterJson: '{"token":"must-not-leak"}',
          ipAddress: "private",
          objectKey: "secret",
        },
        { ...row, id: "event-2" },
        { ...row, id: "event-3" },
      ];
    },
  } as unknown as PrismaService;
  const page = await new CaseActivityService(prisma).list(actor, "case-id", {
    limit: 2,
    resource: malicious,
  });
  assert.equal(page.items.length, 2);
  assert.equal(page.nextCursor, "event-2");
  assert.deepEqual(Object.keys(page.items[0]!).sort(), [
    "action",
    "actorName",
    "createdAt",
    "id",
    "resourceType",
  ]);
  assert.ok(statement);
  assert.ok(!statement.sql.includes(malicious));
  assert.ok(statement.values.includes(malicious));
  assert.ok(statement.values.includes(actor.tenantId));
  assert.ok(statement.sql.includes("EXISTS"));
  assert.ok(!statement.sql.includes("[afterJson]"));
  assert.ok(!statement.sql.includes("[ipAddress]"));
  assert.ok(!statement.sql.includes("[objectKey]"));
});

void test("a cursor outside the authorized case/filter cannot enumerate another timeline", async () => {
  let queries = 0;
  const prisma = {
    verificationCase: { findFirst: () => ({ id: 4n }) },
    $queryRaw: () => {
      queries++;
      return [];
    },
  } as unknown as PrismaService;
  await assert.rejects(
    new CaseActivityService(prisma).list(actor, "case-id", {
      limit: 15,
      cursor: "unknown",
    }),
    /return to the first page/,
  );
  assert.equal(queries, 1);
});

void test("cursor comparisons preserve SQL sub-millisecond precision without a Date round trip", async () => {
  const timestamp = "2026-09-08T12:00:00.1234567";
  const queries: Prisma.Sql[] = [];
  const prisma = {
    verificationCase: { findFirst: () => ({ id: 4n }) },
    $queryRaw: (sql: Prisma.Sql) => {
      queries.push(sql);
      return queries.length === 1
        ? [{ id: "cursor-id", cursorTime: timestamp }]
        : [];
    },
  } as unknown as PrismaService;
  await new CaseActivityService(prisma).list(actor, "case-id", {
    limit: 15,
    cursor: "cursor-id",
  });
  const pagination = queries[1];
  assert.ok(pagination);
  assert.ok(pagination.sql.includes("CONVERT(datetime2,"));
  assert.equal(
    pagination.values.filter((value) => value === timestamp).length,
    2,
  );
  assert.ok(!pagination.values.some((value) => value instanceof Date));
});
