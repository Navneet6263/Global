import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { CrmActivityService } from "../src/crm/crm-activity.service";
import { CrmQueryService } from "../src/crm/crm-query.service";
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
  permissions: ["crm:read"],
} satisfies Actor;

const row = {
  publicId: "9e2523cf-0de7-4d99-8e28-cf9265e1d9c2",
  companyName: "Kaveri Logistics",
};

void test("CRM opportunity pagination returns exact totals and page metadata", async () => {
  let findArgs: Record<string, unknown> | undefined;
  const prisma = {
    salesOpportunity: {
      findMany: (args: Record<string, unknown>) => {
        findArgs = args;
        return [row];
      },
      count: () => 25,
    },
  } as unknown as PrismaService;

  const result = await new CrmQueryService(prisma).list(actor, {
    page: 2,
    limit: 10,
    savedView: "mine",
  });

  assert.equal(findArgs?.["skip"], 10);
  assert.equal(findArgs?.["take"], 10);
  assert.equal(result.total, 25);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.nextCursor, row.publicId);
  assert.equal(result.items[0]?.id, row.publicId);
  const where = findArgs?.["where"] as { AND: Array<{ ownerId?: bigint }> };
  assert.equal(where.AND[0]?.ownerId, actor.userId);
});

void test("CRM activity timeline paginates on the server with owner and type filters", async () => {
  let findArgs: Record<string, unknown> | undefined;
  const prisma = {
    salesActivity: {
      findMany: (args: Record<string, unknown>) => {
        findArgs = args;
        return [
          {
            publicId: "3907892d-3fa5-436a-a139-6d5941a7ff9b",
            type: "STAGE_CHANGED",
            summary: "Stage changed from PROPOSAL to WON",
            occurredAt: new Date("2026-08-27T08:00:00.000Z"),
            actor: { displayName: "CRM Manager" },
            opportunity: {
              publicId: row.publicId,
              companyName: row.companyName,
              contactName: "Neha Joshi",
            },
          },
        ];
      },
      count: () => 42,
    },
  } as unknown as PrismaService;

  const result = await new CrmActivityService(prisma).list(actor, {
    page: 3,
    limit: 12,
    type: "WON",
    owner: actor.userPublicId,
  });

  assert.equal(findArgs?.["skip"], 24);
  assert.equal(findArgs?.["take"], 12);
  assert.equal(result.total, 42);
  assert.equal(result.page, 3);
  assert.equal(result.items[0]?.opportunity.id, row.publicId);
  const where = findArgs?.["where"] as {
    type: string;
    summary: { contains: string };
  };
  assert.equal(where.type, "STAGE_CHANGED");
  assert.equal(where.summary.contains, "to WON");
});
