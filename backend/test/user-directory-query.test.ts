import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import { PrismaService } from "../src/database/prisma.service";
import { UserDirectoryQueryDto } from "../src/users/dto/user-directory-query.dto";
import { UsersService, userDirectoryWhere } from "../src/users/users.service";

const actor: Actor = {
  userId: 10n,
  userPublicId: "00000000-0000-4000-8000-000000000010",
  tenantId: 1n,
  tenantPublicId: "00000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  branchId: 5n,
  email: "operations@greencall.com",
  displayName: "Operations Manager",
  mustChangePassword: false,
  roles: ["OPS_MANAGER"],
  permissions: ["user:read"],
};

void test("directory query normalises filters and validates bounded pages", async () => {
  const query = plainToInstance(UserDirectoryQueryDto, {
    role: "verifier",
    status: "invited",
    page: "3",
    pageSize: "25",
  });
  assert.equal((await validate(query)).length, 0);
  assert.equal(query.role, "VERIFIER");
  assert.equal(query.status, "INVITED");
  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 25);

  const invalid = plainToInstance(UserDirectoryQueryDto, { pageSize: 101 });
  assert.notEqual((await validate(invalid)).length, 0);
});

void test("directory where combines tenant, branch, role, invited and search scopes", () => {
  const where = userDirectoryWhere(actor, {
    role: "VERIFIER",
    status: "INVITED",
    search: "Head Office",
  });
  assert.equal(where.tenantId, 1n);
  assert.equal(where.branchId, 5n);
  assert.equal(where.status, "ACTIVE");
  assert.equal(where.mustChangePassword, true);
  assert.deepEqual(where.userRoles, {
    some: { role: { code: "VERIFIER" } },
  });
  assert.equal(Array.isArray(where.OR), true);
});

void test("directory list uses database pagination and returns the exact total", async () => {
  let findArgs: Record<string, unknown> | undefined;
  let countWhere: unknown;
  const prisma = {
    user: {
      findMany: (input: Record<string, unknown>) => {
        findArgs = input;
        return Promise.resolve([
          {
            publicId: "00000000-0000-4000-8000-000000000020",
            displayName: "Verifier",
            email: "verifier@greencall.com",
            phone: null,
            status: "ACTIVE",
            mustChangePassword: false,
            lastLoginAt: null,
            createdAt: new Date(),
            version: 1,
            branch: null,
            client: null,
            userRoles: [{ role: { code: "VERIFIER", name: "Verifier" } }],
          },
        ]);
      },
      count: (input: { where: unknown }) => {
        countWhere = input.where;
        return Promise.resolve(267);
      },
    },
  };
  const service = new UsersService(prisma as unknown as PrismaService);
  const query = plainToInstance(UserDirectoryQueryDto, {
    page: 2,
    pageSize: 10,
  });
  const result = await service.list(actor, query);

  assert.equal(findArgs?.skip, 10);
  assert.equal(findArgs?.take, 10);
  assert.deepEqual(findArgs?.where, countWhere);
  assert.equal(result.total, 267);
  assert.equal(result.page, 2);
  assert.equal(result.items[0]?.roles[0]?.code, "VERIFIER");
});
