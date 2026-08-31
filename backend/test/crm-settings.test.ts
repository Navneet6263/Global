import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { CrmSettingsService } from "../src/crm/crm-settings.service";
import type { PrismaService } from "../src/database/prisma.service";

const salesActor: Actor = {
  tenantId: 7n,
  tenantPublicId: "2296f108-d071-4850-88f7-9b18bbb81e39",
  tenantName: "Sapling Global",
  userId: 11n,
  userPublicId: "71fb6f14-4ef3-4a7e-84ec-2197bc818eae",
  email: "crm@greencall.com",
  displayName: "CRM Manager",
  mustChangePassword: false,
  roles: ["SALES_MANAGER"],
  permissions: ["crm:read", "crm:write"],
};

const input = {
  version: 1,
  stageProbabilities: {
    NEW: 12,
    QUALIFIED: 35,
    PROPOSAL: 60,
    NEGOTIATION: 80,
    WON: 100,
    LOST: 0,
  },
  leadSources: ["INBOUND", "REFERRAL", "PARTNER"],
};

void test("CRM settings update is tenant-scoped, versioned and audited", async () => {
  let updateWhere: Record<string, unknown> | undefined;
  let auditData: Record<string, unknown> | undefined;
  const existing = {
    id: 21n,
    publicId: "d0baebc7-4e34-41f5-a62d-3141ab39183d",
    newProbability: 10,
    qualifiedProbability: 30,
    proposalProbability: 55,
    negotiationProbability: 75,
    wonProbability: 100,
    lostProbability: 0,
    leadSourcesJson: '["INBOUND","REFERRAL"]',
    version: 1,
    updatedAt: new Date("2026-08-27T10:00:00.000Z"),
  };
  const saved = {
    ...existing,
    newProbability: 12,
    qualifiedProbability: 35,
    proposalProbability: 60,
    negotiationProbability: 80,
    leadSourcesJson: '["INBOUND","REFERRAL","PARTNER"]',
    version: 2,
  };
  const tx = {
    tenantCrmSettings: {
      updateMany: ({ where }: { where: Record<string, unknown> }) => {
        updateWhere = where;
        return { count: 1 };
      },
      findUniqueOrThrow: () => saved,
    },
    auditEvent: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        auditData = data;
      },
    },
  };
  const prisma = {
    tenantCrmSettings: { findUnique: () => existing },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new CrmSettingsService(prisma).update(salesActor, input);

  assert.deepEqual(updateWhere, { id: 21n, version: 1 });
  assert.equal(auditData?.["tenantId"], 7n);
  assert.equal(auditData?.["actorUserId"], 11n);
  assert.equal(auditData?.["action"], "crm.settings.updated");
  assert.equal(result.version, 2);
  assert.deepEqual(result.leadSources, ["INBOUND", "REFERRAL", "PARTNER"]);
});

void test("Platform Admin cannot mutate Sales-owned CRM settings", async () => {
  const prisma = {} as PrismaService;
  const actor = { ...salesActor, roles: ["PLATFORM_ADMIN"] };
  await assert.rejects(
    () => new CrmSettingsService(prisma).update(actor, input),
    ForbiddenException,
  );
});
