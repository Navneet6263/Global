import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { Actor } from "../src/common/auth/actor";
import { CrmOpportunityService } from "../src/crm/crm-opportunity.service";
import type { PrismaService } from "../src/database/prisma.service";
import type { CrmSettingsService } from "../src/crm/crm-settings.service";

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

const baseRecord = {
  publicId: "0cd79e74-d99c-4318-b415-acb849b4a3fc",
  companyName: "Kaveri Logistics",
  city: "Pune",
  industry: "Logistics",
  contactName: "Neha Joshi",
  contactTitle: "VP People",
  contactEmail: "neha@kaveri.example",
  contactPhone: "+919876543210",
  stage: "NEW",
  source: "REFERRAL",
  estimatedValue: 1_250_000,
  probability: 10,
  expectedCloseDate: new Date("2026-11-15T00:00:00.000Z"),
  nextFollowUpAt: null,
  notes: "Pan-India verification requirement",
  lostReason: null,
  closedAt: null,
  version: 1,
  createdAt: new Date("2026-08-27T08:00:00.000Z"),
  updatedAt: new Date("2026-08-27T08:00:00.000Z"),
  owner: null,
  client: null,
};

const settings = {
  resolve: () => ({
    stageProbabilities: {
      NEW: 10,
      QUALIFIED: 30,
      PROPOSAL: 55,
      NEGOTIATION: 75,
      WON: 100,
      LOST: 0,
    },
    leadSources: [
      "INBOUND",
      "OUTBOUND",
      "REFERRAL",
      "EVENT",
      "PARTNER",
      "MARKETPLACE",
    ],
  }),
} as unknown as CrmSettingsService;

void test("opportunity create persists and returns submitted account details", async () => {
  let createData: Record<string, unknown> | undefined;
  const tx = {
    salesOpportunity: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        createData = data;
        return baseRecord;
      },
      findUniqueOrThrow: () => ({ id: 31n }),
    },
    salesActivity: { create: () => undefined },
    auditEvent: { create: () => undefined },
  };
  const prisma = {
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new CrmOpportunityService(prisma, settings).create(
    actor,
    {
      companyName: "Kaveri Logistics",
      city: "Pune",
      industry: "Logistics",
      contactName: "Neha Joshi",
      contactTitle: "VP People",
      contactEmail: "neha@kaveri.example",
      contactPhone: "+919876543210",
      stage: "NEW",
      source: "REFERRAL",
      estimatedValue: 1_250_000,
      expectedCloseDate: "2026-11-15",
      notes: "Pan-India verification requirement",
    },
  );

  assert.equal(createData?.["city"], "Pune");
  assert.equal(createData?.["industry"], "Logistics");
  assert.equal(createData?.["contactTitle"], "VP People");
  assert.equal(createData?.["estimatedValue"], 1_250_000);
  assert.equal(createData?.["probability"], 10);
  assert.equal(createData?.["ownerId"], undefined);
  assert.equal(result.city, "Pune");
  assert.equal(result.industry, "Logistics");
  assert.equal(result.contactTitle, "VP People");
});

void test("opportunity update persists cleared and changed details", async () => {
  let updateData: Record<string, unknown> | undefined;
  const updatedRecord = {
    ...baseRecord,
    city: "Bengaluru",
    industry: null,
    contactTitle: "Chief People Officer",
    ownerId: null,
    version: 2,
  };
  const tx = {
    salesOpportunity: {
      updateMany: ({ data }: { data: Record<string, unknown> }) => {
        updateData = data;
        return { count: 1 };
      },
      findUniqueOrThrow: () => updatedRecord,
    },
    salesActivity: { create: () => undefined },
    auditEvent: { create: () => undefined },
  };
  const prisma = {
    salesOpportunity: {
      findFirst: () => ({
        id: 31n,
        stage: "NEW",
        source: "REFERRAL",
        version: 1,
      }),
    },
    $transaction: async (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;

  const result = await new CrmOpportunityService(prisma, settings).update(
    actor,
    baseRecord.publicId,
    {
      version: 1,
      city: "Bengaluru",
      industry: null,
      contactTitle: "Chief People Officer",
      ownerId: null,
    },
  );

  assert.equal(updateData?.["city"], "Bengaluru");
  assert.equal(updateData?.["industry"], null);
  assert.equal(updateData?.["contactTitle"], "Chief People Officer");
  assert.equal(updateData?.["ownerId"], null);
  assert.equal(result.city, "Bengaluru");
  assert.equal(result.industry, null);
  assert.equal(result.contactTitle, "Chief People Officer");
});

void test("opportunity create rejects a lead source disabled by tenant settings", async () => {
  const restrictedSettings = {
    resolve: () => ({
      stageProbabilities: {
        NEW: 15,
        QUALIFIED: 35,
        PROPOSAL: 60,
        NEGOTIATION: 80,
        WON: 100,
        LOST: 0,
      },
      leadSources: ["INBOUND"],
    }),
  } as unknown as CrmSettingsService;

  await assert.rejects(
    () =>
      new CrmOpportunityService({} as PrismaService, restrictedSettings).create(
        actor,
        {
          companyName: "Kaveri Logistics",
          contactName: "Neha Joshi",
          stage: "NEW",
          source: "REFERRAL",
          estimatedValue: 1_250_000,
          expectedCloseDate: "2026-11-15",
        },
      ),
    BadRequestException,
  );
});
