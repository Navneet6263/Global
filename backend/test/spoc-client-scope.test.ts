import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { spocScope } from "../src/common/auth/access-scope";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { SpocController } from "../src/spoc/spoc.controller";
import { enforceSpocClient } from "../src/spoc/spoc-scope";
import { CreateUserDto } from "../src/users/dto/create-user.dto";
import { UsersService } from "../src/users/users.service";

const CLIENT_A = "0f8fad5b-d9cb-469f-a165-70867728950e";
const CLIENT_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const CLIENT_D = "3b241101-e2bb-4255-8caf-4136c566a962";

function actor(roles: string[], extra: Partial<Actor> = {}): Actor {
  return {
    userId: 11n,
    userPublicId: "00000000-0000-4000-8000-000000000011",
    tenantId: 7n,
    tenantPublicId: "00000000-0000-4000-8000-000000000007",
    tenantName: "Sapling Global",
    email: "spoc@sapling.example",
    displayName: "SPOC",
    mustChangePassword: false,
    roles,
    permissions: roles.includes("PLATFORM_ADMIN") ? ["*"] : ["dashboard:read"],
    ...extra,
  };
}

/** A SPOC-RM assigned clients A and B (SpocClientScope); D is not assigned. */
const spocAB = actor(["SPOC_RM"], {
  spocClients: [
    { id: 41n, publicId: CLIENT_A.toUpperCase(), name: "Client A" },
    { id: 42n, publicId: CLIENT_B, name: "Client B" },
  ],
});

void test("a SPOC-RM case scope covers exactly its assigned clients", () => {
  assert.deepEqual(spocScope(spocAB), {
    tenantId: 7n,
    clientId: { in: [41n, 42n] },
  });
  assert.deepEqual(spocScope(actor(["PLATFORM_ADMIN"])), { tenantId: 7n });
});

void test("a SPOC-RM without a client workspace fails closed", () => {
  for (const empty of [
    actor(["SPOC_RM"]),
    actor(["SPOC_RM"], { spocClients: [] }),
  ]) {
    assert.throws(() => spocScope(empty), ForbiddenException);
    assert.throws(() => enforceSpocClient(empty, {}), ForbiddenException);
  }
});

void test("a request may narrow to an assigned client but never reach another one", () => {
  const noClient: { clientId?: string } = {};
  assert.equal(enforceSpocClient(spocAB, noClient).clientId, undefined);
  assert.equal(
    enforceSpocClient(spocAB, { clientId: CLIENT_A }).clientId,
    CLIENT_A,
  );
  assert.doesNotThrow(() =>
    enforceSpocClient(spocAB, { clientId: CLIENT_B.toUpperCase() }),
  );
  assert.throws(
    () => enforceSpocClient(spocAB, { clientId: CLIENT_D }),
    ForbiddenException,
  );
  const admin = actor(["PLATFORM_ADMIN"]);
  assert.equal(
    enforceSpocClient(admin, { clientId: CLIENT_D }).clientId,
    CLIENT_D,
  );
});

void test("every /spoc query handler enforces the SPOC client before reaching a service", async () => {
  const seen: Array<{ method: string; clientId: unknown }> = [];
  const recorder = new Proxy(
    {},
    {
      get: (_target, method: string) => (_actor: Actor, query: unknown) => {
        seen.push({
          method,
          clientId: (query as { clientId?: unknown } | undefined)?.clientId,
        });
        return Promise.resolve({});
      },
    },
  );
  const services = Array.from({ length: 6 }, () => recorder);
  const controller = new (
    SpocController as unknown as new (
      ...args: unknown[]
    ) => Record<string, (actor: Actor, query: object) => Promise<unknown>>
  )(...services);
  const handlers = [
    "overview",
    "exceptions",
    "clients",
    "cases",
    "qa",
    "tasks",
    "fieldVisits",
    "opportunities",
    "invoices",
  ];
  for (const handler of handlers) {
    await controller[handler]!(spocAB, {});
    assert.throws(
      () => controller[handler]!(spocAB, { clientId: CLIENT_D }),
      ForbiddenException,
      `${handler} must refuse an unassigned client`,
    );
  }
  assert.equal(seen.length, handlers.length);
  // No client chosen stays "all assigned"; services apply the scope themselves.
  assert.ok(seen.every((call) => call.clientId === undefined));
});

function usersPrisma(clients: Array<{ id: bigint; publicId: string }>) {
  return {
    user: { findFirst: () => Promise.resolve(null) },
    role: {
      findMany: ({ where }: { where: { code: { in: string[] } } }) =>
        Promise.resolve(
          where.code.in.map((code, index) => ({ id: BigInt(index + 1), code })),
        ),
    },
    branch: { findFirst: () => Promise.resolve(null) },
    client: {
      findFirst: () => Promise.resolve(clients[0] ?? null),
      findMany: () =>
        Promise.resolve(
          clients.map((client) => ({
            ...client,
            displayName: `Client ${client.id}`,
            status: "ACTIVE",
          })),
        ),
    },
  } as unknown as PrismaService;
}

const createInput = {
  email: "rahul@example.com",
  displayName: "Rahul Kumar",
  roleCodes: ["SPOC_RM"],
  temporaryPassword: "Temporary#Pass2026",
} as CreateUserDto;

void test("creating a SPOC-RM without client workspaces, or with a single clientId, is refused", async () => {
  const service = new UsersService(
    usersPrisma([{ id: 41n, publicId: CLIENT_A }]),
  );
  await assert.rejects(
    service.create(actor(["PLATFORM_ADMIN"]), createInput),
    ConflictException,
  );
  await assert.rejects(
    service.create(actor(["PLATFORM_ADMIN"]), {
      ...createInput,
      clientId: CLIENT_A,
    }),
    ConflictException,
  );
});

void test("creating a SPOC-RM stores every selected client as scope rows, never User.clientId", async () => {
  let created:
    | {
        data: {
          clientId?: bigint;
          mustChangePassword: boolean;
          userRoles: { create: Array<{ roleId: bigint }> };
          spocClientScopes?: { create: Array<{ clientId: bigint }> };
        };
      }
    | undefined;
  const prisma = {
    ...(usersPrisma([
      { id: 41n, publicId: CLIENT_A },
      { id: 42n, publicId: CLIENT_B },
    ]) as unknown as Record<string, unknown>),
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work(
        new Proxy(
          {},
          {
            get: (_t, model: string) =>
              new Proxy(
                {},
                {
                  get: (_m, operation: string) => (args: unknown) => {
                    if (model === "user" && operation === "create") {
                      created = args as typeof created;
                      return Promise.resolve({ id: 99n, publicId: "u-1" });
                    }
                    return Promise.resolve({});
                  },
                },
              ),
          },
        ),
      ),
  } as unknown as PrismaService;
  await new UsersService(prisma).create(actor(["PLATFORM_ADMIN"]), {
    ...createInput,
    spocClientIds: [CLIENT_A, CLIENT_B],
  });
  assert.equal(
    created?.data.clientId,
    undefined,
    "no single client for SPOC-RM",
  );
  assert.deepEqual(created?.data.spocClientScopes?.create, [
    { clientId: 41n },
    { clientId: 42n },
  ]);
  // The only role requested is SPOC_RM (fake role id 1), linked in the same write.
  assert.deepEqual(created?.data.userRoles.create, [{ roleId: 1n }]);
  assert.equal(
    created?.data.mustChangePassword,
    true,
    "existing temporary-password flow",
  );
});

void test("the create-user DTO rejects an invalid email", () => {
  const dto = plainToInstance(CreateUserDto, {
    ...createInput,
    email: "not-an-email",
  });
  assert.ok(validateSync(dto).some((error) => error.property === "email"));
});
