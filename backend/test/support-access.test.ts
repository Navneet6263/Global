import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { caseAccessScope } from "../src/common/auth/access-scope";
import { IS_PUBLIC_KEY } from "../src/common/auth/auth.decorators";
import type { PrismaService } from "../src/database/prisma.service";
import { ClientSupportController } from "../src/support/client-support.controller";
import { SupportController } from "../src/support/support.controller";
import type { CreateUserDto } from "../src/users/dto/create-user.dto";
import {
  OPS_CREATABLE_ROLES,
  assertCanCreateUser,
} from "../src/users/ops-user-creation";
import { assertSafeRoleCombination } from "../src/users/role-combination";
import { UsersService } from "../src/users/users.service";
import { allControllerHandlers, passesGuard } from "./helpers/guard-check";
import { agent, type Args } from "./helpers/support-fixtures";
import { testActor } from "./helpers/test-actor";

const admin = testActor(["PLATFORM_ADMIN"], ["*"]);
const opsTenantWide = testActor(["OPS_MANAGER"], ["user:read"]);

void test("/support admits Support Agents and Platform Admin only; /support-requests admits Client Admin only", () => {
  for (const method of [
    "summary",
    "clients",
    "employees",
    "employee",
    "list",
    "detail",
    "update",
  ]) {
    assert.ok(passesGuard(SupportController, method, agent), method);
    assert.ok(
      passesGuard(SupportController, method, admin, {
        platformAdminViewOnly: false,
      }),
      method,
    );
    // A view-only Platform Admin reads the desk but cannot update requests.
    assert.equal(
      passesGuard(SupportController, method, admin),
      method !== "update",
      method,
    );
    for (const role of [
      "OPS_MANAGER",
      "SPOC_RM",
      "CLIENT_ADMIN",
      "VENDOR",
      "VERIFIER",
      "QA_REVIEWER",
      "FINANCE_MANAGER",
      "SALES_MANAGER",
    ])
      assert.ok(
        !passesGuard(SupportController, method, testActor([role], ["*"])),
        `${role} ${method}`,
      );
  }
  const readOnly = { ...agent, permissions: ["support:read"] };
  assert.ok(passesGuard(SupportController, "employees", readOnly));
  assert.ok(!passesGuard(SupportController, "update", readOnly));
  assert.ok(!passesGuard(SupportController, "list", readOnly));

  const clientAdmin = testActor(["CLIENT_ADMIN"], ["support:request"], {
    clientId: 21n,
  });
  for (const method of ["create", "mine"]) {
    assert.ok(passesGuard(ClientSupportController, method, clientAdmin));
    assert.ok(
      !passesGuard(ClientSupportController, method, {
        ...clientAdmin,
        permissions: ["case:read"],
      }),
    );
    assert.ok(!passesGuard(ClientSupportController, method, agent));
  }
});

void test("outside /support a Support Agent reaches only public links, its session and notifications", async () => {
  const handlers = await allControllerHandlers();
  assert.ok(
    handlers.length > 150,
    "controller handlers were actually inspected",
  );
  const reached = handlers
    .filter(({ controller }) => controller !== SupportController)
    .filter(
      ({ controller, handler }) =>
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) !== true &&
        Reflect.getMetadata(IS_PUBLIC_KEY, controller) !== true,
    )
    .filter(({ controller, method }) => passesGuard(controller, method, agent))
    .map(({ name, method }) => `${name}.${method}`);
  assert.deepEqual(
    reached.filter(
      (entry) =>
        !/^(AuthController|HealthController|NotificationsController)\./.test(
          entry,
        ),
    ),
    [],
  );
  // Every existing case query also fails closed for this role.
  assert.deepEqual(caseAccessScope(agent), { tenantId: 7n, id: -1n });
});

void test("Support Agent is an exclusive role that Ops creates only with the toggle ON and never with a client", async () => {
  assert.ok(OPS_CREATABLE_ROLES.includes("SUPPORT_AGENT"));
  assert.throws(
    () => assertSafeRoleCombination(["SUPPORT_AGENT", "VERIFIER"], true),
    ConflictException,
  );
  const policy = (enabled: boolean) =>
    ({
      tenantAccessPolicy: {
        findUnique: () => Promise.resolve({ opsUserCreationEnabled: enabled }),
      },
    }) as unknown as PrismaService;
  await assert.rejects(
    assertCanCreateUser(policy(false), opsTenantWide, {
      roleCodes: ["SUPPORT_AGENT"],
    }),
    ForbiddenException,
  );
  assert.equal(
    await assertCanCreateUser(policy(true), opsTenantWide, {
      roleCodes: ["SUPPORT_AGENT"],
    }),
    "OPERATIONS",
  );

  const created: Args[] = [];
  const prisma = {
    tenantAccessPolicy: {
      findUnique: () => Promise.resolve({ opsUserCreationEnabled: true }),
    },
    user: { findFirst: () => Promise.resolve(null) },
    role: {
      findMany: ({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          where.code.in.map((code, index) => ({ id: BigInt(index + 1), code })),
        ),
    },
    branch: { findFirst: () => Promise.resolve(null) },
    client: { findFirst: () => Promise.resolve({ id: 21n }) },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work({
        user: {
          create: (value: Args) => {
            created.push(value);
            return Promise.resolve({ publicId: "u-9", email: "s@example.com" });
          },
        },
        auditEvent: { create: () => Promise.resolve({}) },
      }),
  } as unknown as PrismaService;
  const service = new UsersService(prisma);
  const input = {
    email: "s@example.com",
    displayName: "Sia Support",
    roleCodes: ["SUPPORT_AGENT"],
    temporaryPassword: "Temporary#Pass2026",
  } as CreateUserDto;
  await assert.rejects(
    service.create(opsTenantWide, {
      ...input,
      clientId: "11111111-1111-4111-8111-111111111111",
    }),
    ConflictException,
  );
  await assert.rejects(
    service.create(admin, {
      ...input,
      spocClientIds: ["11111111-1111-4111-8111-111111111111"],
    }),
    ConflictException,
  );
  assert.equal(created.length, 0);
  const result = await service.create(opsTenantWide, input);
  assert.deepEqual(result.roles, ["SUPPORT_AGENT"]);
  assert.equal(created[0]?.data?.clientId, undefined);
});
