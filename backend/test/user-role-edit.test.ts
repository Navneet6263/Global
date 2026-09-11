import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import { UsersService } from "../src/users/users.service";
import { PrismaService } from "../src/database/prisma.service";
import { UpdateUserDto } from "../src/users/dto/update-user.dto";

const actor = {
  tenantId: 1n,
  userId: 1n,
  userPublicId: "admin",
  roles: ["PLATFORM_ADMIN"],
} as Actor;
function fixture(current = ["SALES_MANAGER", "OPS_MANAGER", "VERIFIER"]) {
  const writes: { kind: string; input: unknown }[] = [];
  const controls = { others: 1, updated: 1 };
  const user = {
    id: 2n,
    version: 4,
    status: "ACTIVE",
    clientId: null,
    userRoles: current.map((code) => ({ role: { code } })),
  };
  const capture = (kind: string, input: unknown) => {
    writes.push({ kind, input });
    return Promise.resolve({ count: 1 });
  };
  const tx = {
    user: {
      count: () => Promise.resolve(controls.others),
      updateMany: (input: unknown) => {
        writes.push({ kind: "user", input });
        return Promise.resolve({ count: controls.updated });
      },
    },
    userRole: {
      deleteMany: (input: unknown) => capture("remove-roles", input),
      createMany: (input: unknown) => capture("add-roles", input),
    },
    refreshSession: {
      updateMany: (input: unknown) => capture("revoke-sessions", input),
    },
    auditEvent: { create: (input: unknown) => capture("audit", input) },
  };
  const prisma = {
    user: { findFirst: () => Promise.resolve(user) },
    role: {
      findMany: (input: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          input.where.code.in.map((code, index) => ({
            id: BigInt(index + 1),
            code,
          })),
        ),
    },
    $transaction: async (work: (client: typeof tx) => Promise<unknown>) => {
      try {
        return await work(tx);
      } catch (error) {
        writes.length = 0;
        throw error;
      }
    },
  };
  return {
    service: new UsersService(prisma as unknown as PrismaService),
    user,
    writes,
    controls,
  };
}

void test("multiple roles can be reduced to one with session revocation and before/after audit", async () => {
  const setup = fixture();
  const result = await setup.service.update(actor, "target", {
    version: 4,
    roleCodes: ["SALES_MANAGER"],
  });
  assert.deepEqual(result.roleCodes, ["SALES_MANAGER"]);
  assert.equal(result.version, 5);
  assert.equal(
    setup.writes.filter((row) => row.kind === "revoke-sessions").length,
    1,
  );
  const audit = setup.writes.find((row) => row.kind === "audit")!.input as {
    data: { beforeJson: string; afterJson: string; actorUserId: bigint };
  };
  assert.deepEqual(JSON.parse(audit.data.beforeJson).roles, [
    "SALES_MANAGER",
    "OPS_MANAGER",
    "VERIFIER",
  ]);
  assert.deepEqual(JSON.parse(audit.data.afterJson).roles, ["SALES_MANAGER"]);
  assert.equal(audit.data.actorUserId, actor.userId);
  const update = setup.writes.find((row) => row.kind === "user")!.input as {
    data: object;
  };
  assert.equal("branchId" in update.data, false);
  assert.equal("clientId" in update.data, false);
});

void test("reordered unchanged roles do not sign out the account", async () => {
  const setup = fixture(["SALES_MANAGER", "VERIFIER"]);
  await setup.service.update(actor, "target", {
    version: 4,
    roleCodes: ["VERIFIER", "SALES_MANAGER"],
    additionalAccessConfirmed: true,
  });
  assert.equal(
    setup.writes.some((row) => row.kind === "revoke-sessions"),
    false,
  );
});

void test("multiple access needs explicit confirmation and client/admin roles remain exclusive", async () => {
  for (const input of [
    { version: 4, roleCodes: ["SALES_MANAGER", "VERIFIER"] },
    {
      version: 4,
      roleCodes: ["PLATFORM_ADMIN", "VERIFIER"],
      additionalAccessConfirmed: true,
    },
    {
      version: 4,
      roleCodes: ["CLIENT_ADMIN", "VERIFIER"],
      additionalAccessConfirmed: true,
    },
    { version: 4, roleCodes: ["CLIENT_ADMIN"] },
  ]) {
    const setup = fixture();
    await assert.rejects(setup.service.update(actor, "target", input));
    assert.equal(setup.writes.length, 0);
  }
});

void test("last active admin cannot be demoted and stale updates do not overwrite access", async () => {
  const setup = fixture(["PLATFORM_ADMIN"]);
  setup.controls.others = 0;
  await assert.rejects(
    setup.service.update(actor, "target", {
      version: 4,
      roleCodes: ["SALES_MANAGER"],
    }),
    /retain at least one/,
  );
  assert.equal(setup.writes.length, 0);
  await assert.rejects(
    fixture().service.update(actor, "target", {
      version: 3,
      roleCodes: ["VERIFIER"],
    }),
    /changed/,
  );
  const concurrent = fixture();
  concurrent.controls.updated = 0;
  await assert.rejects(
    concurrent.service.update(actor, "target", {
      version: 4,
      roleCodes: ["VERIFIER"],
    }),
    /concurrently/,
  );
  assert.equal(concurrent.writes.length, 0);
});

void test("operations cannot directly invoke access updates", async () => {
  await assert.rejects(
    fixture().service.update({ ...actor, roles: ["OPS_MANAGER"] }, "target", {
      version: 4,
      roleCodes: ["VERIFIER"],
    }),
    ForbiddenException,
  );
});

void test("role edit DTO rejects empty, duplicate and over-limit roles", async () => {
  for (const roleCodes of [
    [],
    ["VERIFIER", "VERIFIER"],
    ["VERIFIER", "OPS_MANAGER", "QA_REVIEWER", "SALES_MANAGER"],
  ]) {
    assert.ok(
      (
        await validate(
          plainToInstance(UpdateUserDto, { version: 4, roleCodes }),
        )
      ).length > 0,
    );
  }
  assert.equal(
    (
      await validate(
        plainToInstance(UpdateUserDto, {
          version: 4,
          roleCodes: ["SALES_MANAGER"],
        }),
      )
    ).length,
    0,
  );
});
