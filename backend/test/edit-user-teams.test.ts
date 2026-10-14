import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Prisma } from "../src/generated/prisma/client";
import { UpdateUserDto } from "../src/users/dto/update-user.dto";
import { syncDepartments } from "../src/users/user-setup";

const EMPLOYMENT = "11111111-1111-4111-8111-111111111111";
const EDUCATION = "22222222-2222-4222-8222-222222222222";
const DATA_ENTRY = "33333333-3333-4333-8333-333333333333";

const DEPARTMENTS = [
  { id: 1n, publicId: EMPLOYMENT, name: "Employment", kind: "VERIFICATION" },
  { id: 2n, publicId: EDUCATION, name: "Education", kind: "VERIFICATION" },
  { id: 3n, publicId: DATA_ENTRY, name: "Data Entry", kind: "DATA_ENTRY" },
];

/** In-memory transaction: department lookups, memberships and audit rows. */
function fakeTx(memberships: Array<{ departmentId: bigint; role: string }>) {
  const audits: Array<{ action: string; resourcePublicId: string }> = [];
  const tx = {
    department: {
      findMany: ({ where }: { where: { publicId: { in: string[] } } }) =>
        Promise.resolve(
          DEPARTMENTS.filter((row) => where.publicId.in.includes(row.publicId)),
        ),
    },
    departmentMember: {
      findMany: () =>
        Promise.resolve(
          memberships.map((row) => ({
            role: row.role,
            department: DEPARTMENTS.find((d) => d.id === row.departmentId)!,
          })),
        ),
      delete: ({ where }: { where: { departmentId_userId: { departmentId: bigint } } }) => {
        const index = memberships.findIndex(
          (row) => row.departmentId === where.departmentId_userId.departmentId,
        );
        memberships.splice(index, 1);
        return Promise.resolve({});
      },
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { departmentId_userId: { departmentId: bigint } };
        update: { role: string };
        create: { departmentId: bigint; role: string };
      }) => {
        const row = memberships.find(
          (entry) => entry.departmentId === where.departmentId_userId.departmentId,
        );
        if (row) row.role = update.role;
        else memberships.push({ departmentId: create.departmentId, role: create.role });
        return Promise.resolve({});
      },
    },
    auditEvent: {
      create: ({ data }: { data: { action: string; resourcePublicId: string } }) => {
        audits.push({ action: data.action, resourcePublicId: data.resourcePublicId });
        return Promise.resolve({});
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, memberships, audits };
}

const base = {
  tenantId: 7n,
  actorUserId: 1n,
  user: { id: 50n, publicId: "user-50", displayName: "Asha" },
};

void test("an existing verifier is made Team Leader of their team and joins another", async () => {
  const { tx, memberships, audits } = fakeTx([{ departmentId: 1n, role: "MEMBER" }]);
  const changes = await syncDepartments(tx, {
    ...base,
    roleCodes: ["SPOC_RM", "VERIFIER"],
    departments: [
      { id: EMPLOYMENT, lead: true },
      { id: EDUCATION, lead: false },
    ],
  });
  assert.deepEqual(memberships, [
    { departmentId: 1n, role: "LEAD" },
    { departmentId: 2n, role: "MEMBER" },
  ]);
  assert.deepEqual(changes, [
    { department: "Employment", role: "LEAD" },
    { department: "Education", role: "MEMBER" },
  ]);
  assert.deepEqual(
    audits.map((row) => row.action),
    ["department.member-role-changed", "department.member-added"],
  );
});

void test("unticked teams are left, and nothing changes when the teams are the same", async () => {
  const { tx, memberships, audits } = fakeTx([
    { departmentId: 1n, role: "LEAD" },
    { departmentId: 2n, role: "MEMBER" },
  ]);
  await syncDepartments(tx, {
    ...base,
    roleCodes: ["VERIFIER"],
    departments: [{ id: EMPLOYMENT, lead: true }],
  });
  assert.deepEqual(memberships, [{ departmentId: 1n, role: "LEAD" }]);
  assert.deepEqual(
    audits.map((row) => row.action),
    ["department.member-removed"],
  );
  const again = await syncDepartments(tx, {
    ...base,
    roleCodes: ["VERIFIER"],
    departments: [{ id: EMPLOYMENT, lead: true }],
  });
  assert.deepEqual(again, []);
});

void test("a team needs the matching role", async () => {
  const { tx } = fakeTx([]);
  await assert.rejects(
    syncDepartments(tx, {
      ...base,
      roleCodes: ["SPOC_RM"],
      departments: [{ id: EMPLOYMENT, lead: true }],
    }),
    (error: unknown) =>
      error instanceof BadRequestException && /give the Verifier role/.test(error.message),
  );
  await assert.rejects(
    syncDepartments(tx, {
      ...base,
      roleCodes: ["VERIFIER"],
      departments: [{ id: DATA_ENTRY }],
    }),
    /give the Data Entry role/,
  );
});

void test("an unknown or inactive team is refused", async () => {
  const { tx } = fakeTx([]);
  await assert.rejects(
    syncDepartments(tx, {
      ...base,
      roleCodes: ["VERIFIER"],
      departments: [{ id: "44444444-4444-4444-8444-444444444444" }],
    }),
    /Choose active teams/,
  );
});

void test("the edit DTO accepts teams with Team Leader and rejects bad team ids", async () => {
  const ok = await validate(
    plainToInstance(UpdateUserDto, {
      version: 2,
      departments: [{ id: EMPLOYMENT, lead: true }],
    }),
  );
  assert.equal(ok.length, 0);
  const bad = await validate(
    plainToInstance(UpdateUserDto, { version: 2, departments: [{ id: "x" }] }),
  );
  assert.ok(bad.length > 0);
});
