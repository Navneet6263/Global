import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ConflictException,
  ForbiddenException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Actor } from "../src/common/auth/actor";
import { PermissionsGuard } from "../src/common/auth/permissions.guard";
import type { PrismaService } from "../src/database/prisma.service";
import { AccessPolicyService } from "../src/settings/access-policy.service";
import { SettingsController } from "../src/settings/settings.controller";
import type { CreateUserDto } from "../src/users/dto/create-user.dto";
import {
  assertCanCreateUser,
  OPS_CREATABLE_ROLES,
  userCreationPolicy,
} from "../src/users/ops-user-creation";
import { UsersController } from "../src/users/users.controller";
import { UsersService } from "../src/users/users.service";

const BRANCH_B = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const OTHER_BRANCH = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const OPS_PERMISSIONS = [
  "dashboard:read",
  "client:read",
  "case:read",
  "user:read",
];

function actor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "ops@sapling.example",
    displayName: "Ops",
    mustChangePassword: false,
    roles,
    permissions: roles.includes("PLATFORM_ADMIN")
      ? ["*"]
      : roles.includes("OPS_MANAGER")
        ? OPS_PERMISSIONS
        : ["dashboard:read"],
    ...extra,
  };
}

const admin = actor(["PLATFORM_ADMIN"]);
const opsTenantWide = actor(["OPS_MANAGER"]);
const opsBranch = actor(["OPS_MANAGER"], {
  branchId: 5n,
  branchPublicId: BRANCH_B.toUpperCase(),
});

function policyPrisma(enabled: boolean | null) {
  let branchWhere: unknown;
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () =>
        Promise.resolve(
          enabled === null ? null : { opsUserCreationEnabled: enabled },
        ),
    },
    role: { findMany: () => Promise.resolve([{ code: "OPS_MANAGER" }]) },
    branch: {
      findMany: (args: { where: unknown }) => {
        branchWhere = args.where;
        return Promise.resolve([
          { publicId: BRANCH_B, name: "Pune", city: "Pune" },
        ]);
      },
    },
  } as unknown as PrismaService;
  return { prisma, branchWhere: () => branchWhere };
}

function allowedByGuard(
  controller: object,
  method: string,
  who: Actor,
): boolean {
  const target = controller as { prototype: Record<string, unknown> };
  const context = {
    getHandler: () => target.prototype[method],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user: who }) }),
  } as unknown as ExecutionContext;
  try {
    return new PermissionsGuard(new Reflector()).canActivate(context);
  } catch {
    return false;
  }
}

void test("POST /users admits Ops Managers to the service gate; every other user write stays admin-only", () => {
  assert.ok(allowedByGuard(UsersController, "create", opsTenantWide));
  assert.ok(allowedByGuard(UsersController, "create", admin));
  assert.ok(!allowedByGuard(UsersController, "create", actor(["VERIFIER"])));
  for (const method of ["update", "resetPassword"]) {
    assert.ok(!allowedByGuard(UsersController, method, opsTenantWide), method);
    assert.ok(allowedByGuard(UsersController, method, admin), method);
  }
  for (const method of ["accessPolicy", "updateAccessPolicy"]) {
    assert.ok(
      !allowedByGuard(SettingsController, method, opsTenantWide),
      method,
    );
    assert.ok(allowedByGuard(SettingsController, method, admin), method);
  }
});

void test("the toggle is OFF by default and OFF refuses every Ops creation", async () => {
  for (const enabled of [null, false]) {
    await assert.rejects(
      assertCanCreateUser(policyPrisma(enabled).prisma, opsTenantWide, {
        roleCodes: ["VERIFIER"],
      }),
      ForbiddenException,
    );
  }
});

void test("with the toggle ON an Ops Manager may create exactly the nine delegated roles", async () => {
  const { prisma } = policyPrisma(true);
  assert.deepEqual([...OPS_CREATABLE_ROLES].sort(), [
    "CLIENT_ADMIN",
    "FIELD_EXECUTIVE",
    "FINANCE_MANAGER",
    "QA_REVIEWER",
    "SALES_MANAGER",
    "SPOC_RM",
    "SUPPORT_AGENT",
    "VENDOR",
    "VERIFIER",
  ]);
  for (const code of OPS_CREATABLE_ROLES) {
    assert.equal(
      await assertCanCreateUser(prisma, opsTenantWide, { roleCodes: [code] }),
      "OPERATIONS",
      code,
    );
  }
  for (const code of ["PLATFORM_ADMIN", "OPS_MANAGER"]) {
    await assert.rejects(
      assertCanCreateUser(prisma, opsTenantWide, {
        roleCodes: ["VERIFIER", code],
      }),
      ForbiddenException,
      code,
    );
  }
});

void test("only admins and Ops Managers pass the gate, and admins still need user:write", async () => {
  const { prisma } = policyPrisma(true);
  assert.equal(
    await assertCanCreateUser(prisma, admin, { roleCodes: ["OPS_MANAGER"] }),
    "ADMIN",
  );
  await assert.rejects(
    assertCanCreateUser(
      prisma,
      { ...admin, permissions: ["user:read"] },
      { roleCodes: ["VERIFIER"] },
    ),
    ForbiddenException,
  );
  await assert.rejects(
    assertCanCreateUser(prisma, actor(["VERIFIER"]), {
      roleCodes: ["VERIFIER"],
    }),
    ForbiddenException,
  );
});

void test("a branch-scoped Ops Manager cannot assign another branch or all-branch access", async () => {
  const { prisma } = policyPrisma(true);
  await assert.rejects(
    assertCanCreateUser(prisma, opsBranch, {
      roleCodes: ["VERIFIER"],
      branchId: OTHER_BRANCH,
    }),
    ForbiddenException,
  );
  for (const code of [
    "VERIFIER",
    "FIELD_EXECUTIVE",
    "QA_REVIEWER",
    "FINANCE_MANAGER",
  ]) {
    await assert.rejects(
      assertCanCreateUser(prisma, opsBranch, { roleCodes: [code] }),
      ForbiddenException,
      code,
    );
    assert.equal(
      await assertCanCreateUser(prisma, opsBranch, {
        roleCodes: [code],
        branchId: BRANCH_B,
      }),
      "OPERATIONS",
    );
  }
  // Client-scoped and CRM roles carry no branch, exactly as in the admin dialog.
  for (const code of ["CLIENT_ADMIN", "SPOC_RM", "SALES_MANAGER"]) {
    assert.equal(
      await assertCanCreateUser(prisma, opsBranch, { roleCodes: [code] }),
      "OPERATIONS",
    );
  }
  assert.equal(
    await assertCanCreateUser(prisma, opsTenantWide, {
      roleCodes: ["VERIFIER"],
      branchId: OTHER_BRANCH,
    }),
    "OPERATIONS",
  );
});

void test("the creation policy tells the Ops UI its roles and branches, never more", async () => {
  assert.deepEqual(
    await userCreationPolicy(policyPrisma(false).prisma, opsBranch),
    {
      enabled: false,
      roles: [],
      branches: [],
      tenantWideAllowed: false,
    },
  );
  const scoped = policyPrisma(true);
  const policy = await userCreationPolicy(scoped.prisma, opsBranch);
  assert.deepEqual(policy.roles, [...OPS_CREATABLE_ROLES]);
  assert.equal(policy.tenantWideAllowed, false);
  assert.deepEqual(scoped.branchWhere(), {
    tenantId: 7n,
    isActive: true,
    id: 5n,
  });
  const wide = policyPrisma(true);
  assert.equal(
    (await userCreationPolicy(wide.prisma, opsTenantWide)).tenantWideAllowed,
    true,
  );
  assert.deepEqual(wide.branchWhere(), { tenantId: 7n, isActive: true });
});

type CreateArgs = {
  data: {
    branchId?: bigint;
    mustChangePassword: boolean;
    userRoles: { create: Array<{ roleId: bigint }> };
  };
};

function usersPrisma(enabled: boolean) {
  const seen: { created?: CreateArgs; auditJson?: string } = {};
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: enabled }),
    },
    user: { findFirst: () => Promise.resolve(null) },
    role: {
      findMany: ({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          where.code.in.map((code, index) => ({ id: BigInt(index + 1), code })),
        ),
    },
    branch: { findFirst: () => Promise.resolve({ id: 5n }) },
    client: { findFirst: () => Promise.resolve(null) },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        user: {
          create: (args: CreateArgs) => {
            seen.created = args;
            return Promise.resolve({ publicId: "u-1", email: "v@example.com" });
          },
        },
        auditEvent: {
          create: (args: { data: { afterJson: string } }) => {
            seen.auditJson = args.data.afterJson;
            return Promise.resolve({});
          },
        },
      }),
  } as unknown as PrismaService;
  return { service: new UsersService(prisma), seen };
}

const verifierInput = {
  email: "v@example.com",
  displayName: "Vikram Verifier",
  roleCodes: ["VERIFIER"],
  branchId: BRANCH_B,
  temporaryPassword: "Temporary#Pass2026",
} as CreateUserDto;

void test("an Ops-created Verifier goes through the existing create flow and is audited", async () => {
  const { service, seen } = usersPrisma(true);
  const result = await service.create(opsBranch, verifierInput);
  assert.deepEqual(result.roles, ["VERIFIER"]);
  assert.equal(seen.created?.data.branchId, 5n);
  assert.deepEqual(seen.created?.data.userRoles.create, [{ roleId: 1n }]);
  assert.equal(seen.created?.data.mustChangePassword, true);
  assert.equal(JSON.parse(seen.auditJson ?? "{}").createdVia, "OPERATIONS");
});

void test("a direct POST /users from an Ops Manager with the toggle OFF writes nothing", async () => {
  const { service, seen } = usersPrisma(false);
  await assert.rejects(
    service.create(opsBranch, verifierInput),
    ForbiddenException,
  );
  assert.equal(seen.created, undefined);
});

void test("admin creation is unchanged and its audit carries no delegation marker", async () => {
  const { service, seen } = usersPrisma(false);
  await service.create(admin, { ...verifierInput, roleCodes: ["OPS_MANAGER"] });
  assert.deepEqual(JSON.parse(seen.auditJson ?? "{}"), {
    email: "v@example.com",
    roles: ["OPS_MANAGER"],
  });
});

void test("the access policy switch is versioned and audited", async () => {
  let auditAction: string | undefined;
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () =>
        Promise.resolve({ id: 1n, publicId: "p-1", version: 3 }),
    },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        tenantAccessPolicy: {
          updateMany: () => Promise.resolve({ count: 1 }),
          findUniqueOrThrow: () =>
            Promise.resolve({ opsUserCreationEnabled: true, version: 4 }),
        },
        auditEvent: {
          create: (args: { data: { action: string } }) => {
            auditAction = args.data.action;
            return Promise.resolve({});
          },
        },
      }),
  } as unknown as PrismaService;
  const service = new AccessPolicyService(prisma);
  await assert.rejects(
    service.update(admin, { opsUserCreationEnabled: true, version: 2 }),
    ConflictException,
  );
  const updated = await service.update(admin, {
    opsUserCreationEnabled: true,
    version: 3,
  });
  assert.equal(updated.opsUserCreationEnabled, true);
  assert.equal(auditAction, "settings.access-policy.updated");
});
