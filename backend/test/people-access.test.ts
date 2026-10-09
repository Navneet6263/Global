import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { caseAccessScope } from "../src/common/auth/access-scope";
import { hasRole, roleIs } from "../src/common/auth/role-filter";
import type { Prisma } from "../src/generated/prisma/client";
import { joinDepartments, personalRoles } from "../src/users/user-setup";

const base = { tenantId: 1n, userId: 7n } as const;

void test("an RM who is also Data Entry sees both sets of cases, nothing more", () => {
  const scope = caseAccessScope({
    ...base,
    roles: ["SPOC_RM", "DATA_ENTRY"],
    spocClients: [{ id: 9n }],
    departments: [],
  } as unknown as Actor) as { tenantId: bigint; AND: Array<{ OR: unknown[] }> };
  assert.equal(scope.tenantId, 1n);
  assert.deepEqual(scope.AND[0]!.OR, [
    { workflowVersion: 2, dataEntryUserId: 7n },
    { clientId: { in: [9n] } },
  ]);
});

void test("a single working role keeps exactly its old scope", () => {
  assert.deepEqual(
    caseAccessScope({ ...base, roles: ["QA_REVIEWER"] } as unknown as Actor),
    { tenantId: 1n, qaReviewerId: 7n },
  );
  assert.deepEqual(
    caseAccessScope({ ...base, roles: ["SALES_MANAGER"] } as unknown as Actor),
    {
      tenantId: 1n,
      id: -1n,
    },
  );
});

void test("with branch scoping off nobody carries a branch, so no branch filter applies", () => {
  const scope = caseAccessScope({
    ...base,
    roles: ["QA_REVIEWER"],
    branchId: undefined,
  } as unknown as Actor);
  assert.equal("branchId" in scope, false);
});

void test("role lookups include custom roles built on the system role", () => {
  assert.deepEqual(roleIs("VERIFIER"), {
    OR: [{ code: "VERIFIER" }, { baseRoleCode: "VERIFIER" }],
  });
  assert.deepEqual(hasRole("DATA_ENTRY"), {
    userRoles: {
      some: {
        role: { OR: [{ code: "DATA_ENTRY" }, { baseRoleCode: "DATA_ENTRY" }] },
      },
    },
  });
});

function setupTx() {
  const roles: Array<Record<string, unknown>> = [];
  const members: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const tx = {
    role: {
      findFirst: () => ({
        name: "Data Entry",
        permissionsJson: JSON.stringify([
          "case:read",
          "clarification:write",
          "document:read",
        ]),
      }),
      create: (args: { data: Record<string, unknown> }) => {
        roles.push(args.data);
        return { id: 99n, code: args.data.code, publicId: "role-1" };
      },
    },
    department: {
      findMany: () => [
        { id: 4n, publicId: "dept-de", name: "Data Entry", kind: "DATA_ENTRY" },
      ],
    },
    departmentMember: {
      create: (args: { data: Record<string, unknown> }) =>
        members.push(args.data),
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, roles, members, audits };
}

void test("unticking access creates a personal role on the base and gives it instead", async () => {
  const { tx, roles, audits } = setupTx();
  const result = await personalRoles(tx, {
    tenantId: 1n,
    actorUserId: 2n,
    displayName: "Rahul",
    roles: [
      { id: 3n, code: "DATA_ENTRY" },
      { id: 5n, code: "SPOC_RM" },
    ],
    access: [
      { role: "DATA_ENTRY", permissions: ["case:read", "document:read"] },
    ],
  });
  assert.equal(roles[0]!.name, "Data Entry · Rahul");
  assert.equal(roles[0]!.baseRoleCode, "DATA_ENTRY");
  assert.equal(
    roles[0]!.permissionsJson,
    JSON.stringify(["case:read", "document:read"]),
  );
  assert.deepEqual(
    result.roles.map((role) => role.id),
    [99n, 5n],
  );
  assert.deepEqual(audits, ["role.custom-created"]);
});

void test("full ticks need no personal role; extra or foreign access is refused", async () => {
  const full = setupTx();
  const same = await personalRoles(full.tx, {
    tenantId: 1n,
    actorUserId: 2n,
    displayName: "Rahul",
    roles: [{ id: 3n, code: "DATA_ENTRY" }],
    access: [
      {
        role: "DATA_ENTRY",
        permissions: ["case:read", "clarification:write", "document:read"],
      },
    ],
  });
  assert.equal(full.roles.length, 0);
  assert.deepEqual(same.roles, [{ id: 3n, code: "DATA_ENTRY" }]);
  await assert.rejects(
    personalRoles(setupTx().tx, {
      tenantId: 1n,
      actorUserId: 2n,
      displayName: "Rahul",
      roles: [{ id: 3n, code: "DATA_ENTRY" }],
      access: [
        { role: "DATA_ENTRY", permissions: ["case:read", "user:write"] },
      ],
    }),
    /cannot go beyond/,
  );
  await assert.rejects(
    personalRoles(setupTx().tx, {
      tenantId: 1n,
      actorUserId: 2n,
      displayName: "Rahul",
      roles: [{ id: 5n, code: "SPOC_RM" }],
      access: [{ role: "SPOC_RM", permissions: ["case:read"] }],
    }),
    /Access can be customised/,
  );
});

void test("a new person joins their team as Team Leader, but only with the matching role", async () => {
  const { tx, members, audits } = setupTx();
  const joined = await joinDepartments(tx, {
    tenantId: 1n,
    actorUserId: 2n,
    user: { id: 8n, publicId: "user-8", displayName: "Rahul" },
    roleCodes: ["DATA_ENTRY"],
    departments: [{ id: "dept-de", lead: true }],
  });
  assert.deepEqual(joined, ["Data Entry"]);
  assert.equal(members[0]!.role, "LEAD");
  assert.deepEqual(audits, ["department.member-added"]);
  await assert.rejects(
    joinDepartments(setupTx().tx, {
      tenantId: 1n,
      actorUserId: 2n,
      user: { id: 8n, publicId: "user-8", displayName: "Rahul" },
      roleCodes: ["VERIFIER"],
      departments: [{ id: "dept-de" }],
    }),
    /Data Entry team/,
  );
});
