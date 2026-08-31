import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException } from "@nestjs/common";
import { CrmFollowUpService } from "../src/crm/crm-follow-up.service";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";

const actor: Actor = {
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
};

void test("completing a CRM follow-up clears its date and writes activity plus audit", async () => {
  const writes: Array<{ kind: string; data: unknown }> = [];
  const tx = {
    salesOpportunity: {
      updateMany: (args: unknown) => {
        writes.push({ kind: "opportunity", data: args });
        return { count: 1 };
      },
    },
    salesActivity: {
      create: (args: unknown) => writes.push({ kind: "activity", data: args }),
    },
    auditEvent: {
      create: (args: unknown) => writes.push({ kind: "audit", data: args }),
    },
  };
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 19n,
        stage: "NEGOTIATION",
        version: 4,
        nextFollowUpAt: new Date("2026-08-27T09:00:00.000Z"),
      }),
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new CrmFollowUpService(prisma).complete(
    actor,
    "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
    { version: 4, notes: "Decision maker contacted" },
  );

  assert.equal(result.version, 5);
  assert.deepEqual(
    writes.map((write) => write.kind),
    ["opportunity", "activity", "audit"],
  );
  const opportunityWrite = writes[0]!.data as {
    data: { nextFollowUpAt: unknown };
  };
  const auditWrite = writes[2]!.data as { data: { action: string } };
  assert.equal(opportunityWrite.data.nextFollowUpAt, null);
  assert.equal(auditWrite.data.action, "crm.follow-up.completed");
});

void test("stale follow-up completion is rejected before any write", async () => {
  let transactionCalled = false;
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 19n,
        stage: "QUALIFIED",
        version: 5,
        nextFollowUpAt: new Date(),
      }),
    },
    $transaction: () => {
      transactionCalled = true;
    },
  } as unknown as PrismaService;

  await assert.rejects(
    new CrmFollowUpService(prisma).complete(
      actor,
      "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
      { version: 4 },
    ),
    ConflictException,
  );
  assert.equal(transactionCalled, false);
});
