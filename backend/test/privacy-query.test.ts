import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { PrivacyQueryService } from "../src/privacy/privacy-query.service";
import { PrivacyQueryDto } from "../src/privacy/privacy.dto";

const actor = { userId: 9n, tenantId: 3n, roles: ["PLATFORM_ADMIN"] } as Actor;

void test("privacy list applies tenant, kind, status and bounded pagination to both queries", async () => {
  const calls: Array<{ where: unknown; skip?: number; take?: number }> = [];
  const prisma = {
    privacyRecord: {
      count: (query: { where: unknown }) => {
        calls.push(query);
        return Promise.resolve(25);
      },
      findMany: (query: { where: unknown; skip: number; take: number }) => {
        calls.push(query);
        return Promise.resolve([{ publicId: "record", status: "OPEN" }]);
      },
    },
    $transaction: (work: Promise<unknown>[]) => Promise.all(work),
  } as unknown as PrismaService;
  const result = await new PrivacyQueryService(prisma).list(actor, {
    kind: "INCIDENT",
    status: "OPEN",
    search: "  mailbox  ",
    page: 2,
    pageSize: 12,
  });
  assert.equal(result.total, 25);
  assert.equal(result.pageCount, 3);
  assert.equal(result.items[0]?.id, "record");
  assert.deepEqual(calls[0]?.where, calls[1]?.where);
  assert.deepEqual(calls[0]?.where, {
    tenantId: 3n,
    kind: "INCIDENT",
    status: "OPEN",
    OR: [
      { title: { contains: "mailbox" } },
      { subjectReference: { contains: "mailbox" } },
    ],
  });
  assert.equal(calls[1]?.skip, 12);
  assert.equal(calls[1]?.take, 12);
});

void test("privacy details and timeline cannot be accessed by another tenant or role", async () => {
  const service = new PrivacyQueryService({
    privacyRecord: { findFirst: () => Promise.resolve(null) },
  } as unknown as PrismaService);
  await assert.rejects(service.get(actor, "other-tenant-record"), /not found/);
  await assert.rejects(
    service.events(actor, "other-tenant-record", { page: 1, pageSize: 12 }),
    /not found/,
  );
  await assert.rejects(
    service.list(
      { ...actor, roles: ["OPS_MANAGER"] },
      { page: 1, pageSize: 12 },
    ),
    /platform administrators/,
  );
});

void test("privacy query DTO rejects unbounded and invalid filters", async () => {
  assert.equal(
    (
      await validate(
        plainToInstance(PrivacyQueryDto, {
          page: "1",
          pageSize: "12",
          kind: "INCIDENT",
        }),
      )
    ).length,
    0,
  );
  assert.ok(
    (
      await validate(
        plainToInstance(PrivacyQueryDto, {
          page: "0",
          pageSize: "500",
          kind: "UNKNOWN",
        }),
      )
    ).length >= 3,
  );
});
