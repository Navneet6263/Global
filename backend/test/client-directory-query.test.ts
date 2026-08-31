import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { clientDirectoryWhere } from "../src/clients/clients.service";
import { ClientQueryDto } from "../src/clients/dto/client-query.dto";
import type { Actor } from "../src/common/auth/actor";

const actor: Actor = {
  tenantId: 11n,
  tenantPublicId: "10000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  userId: 22n,
  userPublicId: "20000000-0000-4000-8000-000000000002",
  email: "admin@sapling.example",
  displayName: "Platform Admin",
  mustChangePassword: false,
  roles: ["PLATFORM_ADMIN"],
  permissions: ["*"],
};

void test("client directory validates server page and status filters", async () => {
  const query = plainToInstance(ClientQueryDto, {
    page: "3",
    pageSize: "25",
    status: "SUSPENDED",
    search: "Acme",
  });
  assert.deepEqual(await validate(query), []);
  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 25);

  const where = clientDirectoryWhere(actor, query);
  assert.equal(where.tenantId, actor.tenantId);
  assert.equal(where.status, "SUSPENDED");
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 5);
});

void test("client directory rejects unsupported status and oversized page", async () => {
  const query = plainToInstance(ClientQueryDto, {
    page: "0",
    pageSize: "101",
    status: "DELETED",
  });
  const errors = await validate(query);
  assert.ok(errors.some((error) => error.property === "page"));
  assert.ok(errors.some((error) => error.property === "pageSize"));
  assert.ok(errors.some((error) => error.property === "status"));
});
