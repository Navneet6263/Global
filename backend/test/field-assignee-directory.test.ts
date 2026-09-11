import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { fieldAssigneeScope } from "../src/field-visits/field-assignee-scope";
import { FieldVisitAssignmentService } from "../src/field-visits/field-visit-assignment.service";

const actor = { tenantId: 1n, branchId: 2n, roles: ["OPS_MANAGER"] } as Actor;

void test("Head Office operations can discover all-branch field1 for an accessible unbranched case", async () => {
  const expected = fieldAssigneeScope(1n, { branchId: null, clientId: 3n });
  const db = {
    verificationCase: {
      findFirst: (input: { where: unknown }) => {
        assert.deepEqual(input.where, {
          tenantId: 1n,
          OR: [{ branchId: 2n }, { branchId: null }],
          publicId: "rani-case",
        });
        return { branchId: null, clientId: 3n };
      },
    },
    user: {
      findMany: (input: { where: unknown; skip: number; take: number }) => {
        assert.deepEqual(input.where, expected);
        assert.equal(input.skip, 100);
        assert.equal(input.take, 100);
        return [
          {
            publicId: "field1",
            displayName: "field1",
            email: "field1@example.invalid",
          },
        ];
      },
      count: (input: { where: unknown }) => {
        assert.deepEqual(input.where, expected);
        return 101;
      },
    },
  } as unknown as PrismaService;
  const result = await new FieldVisitAssignmentService(db).eligibleAssignees(
    actor,
    "rani-case",
    {
      page: 2,
      pageSize: 100,
    },
  );
  assert.equal(result.items[0].id, "field1");
  assert.equal(result.total, 101);
});

void test("field picker policy preserves tenant, active role and compatible branch/client restrictions", () => {
  assert.deepEqual(fieldAssigneeScope(1n, { branchId: 2n, clientId: 3n }), {
    tenantId: 1n,
    status: "ACTIVE",
    AND: [
      { OR: [{ branchId: 2n }, { branchId: null }] },
      { OR: [{ clientId: null }, { clientId: 3n }] },
    ],
    userRoles: { some: { role: { code: "FIELD_EXECUTIVE" } } },
  });
  assert.deepEqual(
    fieldAssigneeScope(1n, { branchId: null, clientId: 3n }).AND,
    [{ branchId: null }, { OR: [{ clientId: null }, { clientId: 3n }] }],
  );
});

void test("inaccessible case and non-operations actor cannot enumerate field accounts", async () => {
  const db = {
    verificationCase: { findFirst: () => null },
    user: { findMany: () => assert.fail("Must not enumerate users") },
  } as unknown as PrismaService;
  const service = new FieldVisitAssignmentService(db);
  await assert.rejects(
    service.eligibleAssignees(actor, "other-case", { page: 1, pageSize: 100 }),
    /Case not found/,
  );
  await assert.rejects(
    service.eligibleAssignees(
      { ...actor, roles: ["FIELD_EXECUTIVE"] },
      "rani-case",
      { page: 1, pageSize: 100 },
    ),
    /Only operations/,
  );
});
