import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { PrismaService } from "../src/database/prisma.service";
import { UpdateUserDto } from "../src/users/dto/update-user.dto";
import { UsersService } from "../src/users/users.service";
import { A, B, C, D, admin, spocActor } from "./helpers/spoc-fixtures";
import { bigJson } from "./helpers/test-actor";

type ScopeWrite = { data: unknown; where?: unknown };

function editPrisma(options: {
  roles: string[];
  scope: Array<{ id: bigint; publicId: string; displayName: string }>;
  clients?: Array<{ id: bigint; publicId: string; status: string }>;
}) {
  const writes: Array<{ kind: string; args: ScopeWrite }> = [];
  const record = (kind: string) => (args: ScopeWrite) => {
    writes.push({ kind, args });
    return Promise.resolve({ count: 1 });
  };
  const prisma = {
    // The admin switch "Ops Managers can create users" is OFF here.
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: false }),
    },
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 2n,
          version: 4,
          status: "ACTIVE",
          clientId: null,
          userRoles: options.roles.map((code) => ({ role: { code } })),
          spocClientScopes: options.scope.map((client) => ({ client })),
        }),
    },
    role: {
      findMany: ({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          where.code.in.map((code, index) => ({ id: BigInt(index + 1), code })),
        ),
    },
    client: {
      findMany: () =>
        Promise.resolve(
          (options.clients ?? []).map((client) => ({
            ...client,
            displayName: `Client ${client.id}`,
          })),
        ),
    },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        user: {
          updateMany: record("user"),
          count: () => Promise.resolve(1),
          // Company-RM claim lookups are covered in rm-company-claim.test.ts.
          findFirst: () => Promise.resolve(null),
        },
        userRole: {
          deleteMany: record("roles-"),
          createMany: record("roles+"),
        },
        spocClientScope: {
          deleteMany: record("scope-"),
          createMany: record("scope+"),
        },
        refreshSession: { updateMany: record("sessions") },
        auditEvent: { create: record("audit") },
      }),
  } as unknown as PrismaService;
  return { service: new UsersService(prisma), writes };
}

const scopeABC = [
  { id: 41n, publicId: A, displayName: "Client A" },
  { id: 42n, publicId: B, displayName: "Client B" },
  { id: 43n, publicId: C, displayName: "Client C" },
];

void test("edit role access replaces a SPOC-RM's clients in one audited write", async () => {
  const { service, writes } = editPrisma({
    roles: ["SPOC_RM"],
    scope: scopeABC,
    clients: [
      { id: 41n, publicId: A, status: "ACTIVE" },
      { id: 43n, publicId: C, status: "SUSPENDED" },
    ],
  });
  const result = await service.update(admin, "user-2", {
    version: 4,
    spocClientIds: [A, C],
  });
  const kinds = writes.map((write) => write.kind);
  assert.deepEqual(kinds, ["user", "scope-", "scope+", "audit"]);
  assert.equal(
    bigJson(writes[2]?.args.data),
    bigJson([
      { userId: 2n, clientId: 41n },
      { userId: 2n, clientId: 43n },
    ]),
  );
  const audit = writes[3]?.args.data as {
    beforeJson: string;
    afterJson: string;
  };
  assert.deepEqual(JSON.parse(audit.beforeJson).clients, [A, B, C]);
  assert.deepEqual(JSON.parse(audit.afterJson).clients, [A, C]);
  assert.deepEqual(
    result.spocClients?.map((client) => client.id),
    [A, C],
  );
});

void test("edit role access keeps every other rule for SPOC-RM scope", async () => {
  // Adding a suspended client is refused; keeping one already held is fine.
  await assert.rejects(
    editPrisma({
      roles: ["SPOC_RM"],
      scope: [scopeABC[0]!],
      clients: [
        { id: 41n, publicId: A, status: "ACTIVE" },
        { id: 44n, publicId: D, status: "SUSPENDED" },
      ],
    }).service.update(admin, "user-2", { version: 4, spocClientIds: [A, D] }),
    /suspended or closed/,
  );
  // A company still onboarding can be given to its RM.
  await editPrisma({
    roles: ["SPOC_RM"],
    scope: [scopeABC[0]!],
    clients: [
      { id: 41n, publicId: A, status: "ACTIVE" },
      { id: 44n, publicId: D, status: "ONBOARDING" },
    ],
  }).service.update(admin, "user-2", { version: 4, spocClientIds: [A, D] });
  // Becoming SPOC-RM with no company is fine; companies come later.
  await editPrisma({ roles: ["VERIFIER"], scope: [] }).service.update(
    admin,
    "user-2",
    { version: 4, roleCodes: ["SPOC_RM"] },
  );
  // Other roles never take a client list.
  await assert.rejects(
    editPrisma({ roles: ["VERIFIER"], scope: [] }).service.update(
      admin,
      "user-2",
      { version: 4, spocClientIds: [A] },
    ),
    ConflictException,
  );
  // Leaving SPOC-RM removes its client access in the same write.
  const leaving = editPrisma({ roles: ["SPOC_RM"], scope: scopeABC });
  await leaving.service.update(admin, "user-2", {
    version: 4,
    roleCodes: ["VERIFIER"],
  });
  assert.ok(leaving.writes.some((write) => write.kind === "scope-"));
  assert.ok(!leaving.writes.some((write) => write.kind === "scope+"));
  // An empty list is valid: it removes every company from the RM.
  const empty = plainToInstance(UpdateUserDto, {
    version: 4,
    spocClientIds: [],
  });
  assert.ok(
    !validateSync(empty).some((error) => error.property === "spocClientIds"),
  );
  // With the admin switch OFF, only the Platform Admin edits access.
  await assert.rejects(
    editPrisma({ roles: ["SPOC_RM"], scope: scopeABC }).service.update(
      spocActor(["OPS_MANAGER"]),
      "user-2",
      { version: 4, spocClientIds: [A] },
    ),
    ForbiddenException,
  );
});

void test("Ops Managers create multi-client SPOC-RMs through the same toggle-gated path", async () => {
  let created:
    { data: { spocClientScopes?: { create: unknown[] } } } | undefined;
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: true }),
    },
    user: { findFirst: () => Promise.resolve(null) },
    role: {
      findMany: () => Promise.resolve([{ id: 1n, code: "SPOC_RM" }]),
    },
    branch: { findFirst: () => Promise.resolve(null) },
    client: {
      findFirst: () => Promise.resolve(null),
      findMany: () =>
        Promise.resolve([
          { id: 41n, publicId: A, displayName: "Client A", status: "ACTIVE" },
          { id: 42n, publicId: B, displayName: "Client B", status: "ACTIVE" },
        ]),
    },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        user: {
          create: (args: typeof created) => {
            created = args;
            return Promise.resolve({ publicId: "u-9", email: "s@example.com" });
          },
          // Company-RM claim lookups are covered in rm-company-claim.test.ts.
          findFirst: () => Promise.resolve(null),
        },
        auditEvent: { create: () => Promise.resolve({}) },
      }),
  } as unknown as PrismaService;
  const result = await new UsersService(prisma).create(
    spocActor(["OPS_MANAGER"]),
    {
      email: "s@example.com",
      displayName: "Sana SPOC",
      roleCodes: ["SPOC_RM"],
      spocClientIds: [A, B],
      temporaryPassword: "Temporary#Pass2026",
    },
  );
  assert.equal(created?.data.spocClientScopes?.create.length, 2);
  assert.deepEqual(
    result.spocClients?.map((client) => client.displayName),
    ["Client A", "Client B"],
  );
});

void test("the migration moves each existing SPOC-RM client into the scope table", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../prisma/migrations/20260929100000_spoc_client_scope/migration.sql",
    ),
    "utf8",
  );
  assert.match(sql, /CREATE TABLE \[dbo\]\.\[SpocClientScope\]/);
  assert.match(
    sql,
    /INSERT INTO \[dbo\]\.\[SpocClientScope\][\s\S]*\[r\]\.\[code\] = 'SPOC_RM'/,
  );
  assert.match(sql, /SET \[u\]\.\[clientId\] = NULL/);
  assert.ok(
    sql.indexOf("INSERT INTO [dbo].[SpocClientScope]") <
      sql.indexOf("SET [u].[clientId] = NULL"),
    "backfill runs before the single client is cleared",
  );
});
