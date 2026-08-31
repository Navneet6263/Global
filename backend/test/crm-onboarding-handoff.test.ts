import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { CrmHandoffService } from "../src/crm/crm-handoff.service";
import type { PrismaService } from "../src/database/prisma.service";

const actor = {
  tenantId: 7n,
  tenantPublicId: "2296f108-d071-4850-88f7-9b18bbb81e39",
  tenantName: "Sapling Global",
  userId: 11n,
  userPublicId: "71fb6f14-4ef3-4a7e-84ec-2197bc818eae",
  sessionPublicId: "cb940e6f-69e8-436e-a430-207114dfb65c",
  email: "crm@greencall.com",
  displayName: "CRM Manager",
  mustChangePassword: false,
  roles: ["SALES_MANAGER"],
  permissions: ["crm:write"],
} satisfies Actor;

void test("a won opportunity creates one durable onboarding handoff", async () => {
  const writes: string[] = [];
  const tx = {
    salesOpportunity: {
      updateMany: () => {
        writes.push("opportunity");
        return { count: 1 };
      },
    },
    salesActivity: { create: () => writes.push("activity") },
    auditEvent: { create: () => writes.push("audit") },
  };
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 19n,
        stage: "WON",
        version: 3,
        onboardingHandoffAt: null,
      }),
    },
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new CrmHandoffService(prisma).prepare(
    actor,
    "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
    { version: 3 },
  );

  assert.equal(result.version, 4);
  assert.ok(result.preparedAt instanceof Date);
  assert.deepEqual(writes, ["opportunity", "activity", "audit"]);
});

void test("repeating an existing handoff is idempotent", async () => {
  const preparedAt = new Date("2026-08-27T08:00:00.000Z");
  let transactionCalled = false;
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 19n,
        stage: "WON",
        version: 4,
        onboardingHandoffAt: preparedAt,
      }),
    },
    $transaction: () => {
      transactionCalled = true;
    },
  } as unknown as PrismaService;

  const result = await new CrmHandoffService(prisma).prepare(
    actor,
    "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
    { version: 3 },
  );

  assert.equal(result.preparedAt, preparedAt);
  assert.equal(result.version, 4);
  assert.equal(transactionCalled, false);
});

void test("an open opportunity cannot be handed to onboarding", async () => {
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 19n,
        stage: "NEGOTIATION",
        version: 3,
        onboardingHandoffAt: null,
      }),
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new CrmHandoffService(prisma).prepare(
      actor,
      "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
      { version: 3 },
    ),
    BadRequestException,
  );
});
