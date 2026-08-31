import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Actor } from "../src/common/auth/actor";
import { PrismaService } from "../src/database/prisma.service";
import { UserActivityQueryDto } from "../src/users/dto/user-activity-query.dto";
import { UsersService } from "../src/users/users.service";

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

void test("user activity query validates bounded database pages", async () => {
  const query = plainToInstance(UserActivityQueryDto, { page: "3", pageSize: "50" });
  assert.equal((await validate(query)).length, 0);
  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 50);

  const invalid = plainToInstance(UserActivityQueryDto, { pageSize: 51 });
  assert.notEqual((await validate(invalid)).length, 0);
});

void test("employee timeline includes all actor actions and account-targeted events", async () => {
  let findArgs: Record<string, unknown> | undefined;
  let countWhere: unknown;
  const createdAt = new Date("2026-08-31T10:00:00.000Z");
  const prisma = {
    user: {
      findFirst: () =>
        Promise.resolve({
          id: 27n,
          displayName: "Verifier One",
          email: "verifier@greencall.com",
        }),
    },
    auditEvent: {
      findMany: (input: Record<string, unknown>) => {
        findArgs = input;
        return Promise.resolve([
          {
            publicId: "00000000-0000-4000-8000-000000000099",
            action: "document.downloaded",
            resourceType: "document",
            resourcePublicId: "00000000-0000-4000-8000-000000000088",
            requestId: "request-1",
            ipAddress: "127.0.0.1",
            locationLabel: null,
            beforeJson: null,
            afterJson: '{"caseNumber":"SG-1"}',
            createdAt,
            actor: {
              displayName: "Verifier One",
              email: "verifier@greencall.com",
            },
          },
        ]);
      },
      count: (input: { where: unknown }) => {
        countWhere = input.where;
        return Promise.resolve(11);
      },
    },
  };
  const service = new UsersService(prisma as unknown as PrismaService);
  const query = plainToInstance(UserActivityQueryDto, { page: 2, pageSize: 10 });
  const result = await service.activity(
    actor,
    "00000000-0000-4000-8000-000000000027",
    query,
  );

  assert.equal(findArgs?.skip, 10);
  assert.equal(findArgs?.take, 10);
  assert.deepEqual(findArgs?.where, countWhere);
  assert.deepEqual((findArgs?.where as { OR: unknown[] }).OR, [
    { actorUserId: 27n },
    {
      resourceType: "user",
      resourcePublicId: "00000000-0000-4000-8000-000000000027",
    },
  ]);
  assert.equal(result.total, 11);
  assert.equal(result.items[0]?.locationLabel, "Local device");
  assert.equal(result.items[0]?.action, "document.downloaded");
});
