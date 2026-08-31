import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { DashboardClientService } from "../src/dashboards/dashboard-client.service";
import type { PrismaService } from "../src/database/prisma.service";

const actor: Actor = {
  userId: 2n,
  userPublicId: "20000000-0000-4000-8000-000000000002",
  tenantId: 1n,
  tenantPublicId: "10000000-0000-4000-8000-000000000001",
  tenantName: "Sapling Global",
  clientId: 9n,
  clientPublicId: "90000000-0000-4000-8000-000000000009",
  clientName: "Navneet Kirana",
  email: "client@greencall.com",
  displayName: "Client Admin",
  mustChangePassword: false,
  roles: ["CLIENT_ADMIN"],
  permissions: ["dashboard:read"],
};

void test("client analytics stays client-scoped and identifies quality hotspots", async () => {
  const scopes: unknown[] = [];
  const prisma = {
    verificationCase: {
      groupBy: (input: { where: unknown }) => {
        scopes.push(input.where);
        return Promise.resolve([
          {
            status: "IN_PROGRESS",
            _count: { _all: 3 },
            _min: { updatedAt: new Date(Date.now() - 4 * 3_600_000) },
          },
        ]);
      },
    },
    caseCheck: {
      groupBy: (input: { where: unknown }) => {
        scopes.push(input.where);
        return Promise.resolve([
          {
            type: "IDENTITY",
            status: "COMPLETED",
            result: "CLEAR",
            _count: { _all: 8 },
          },
          {
            type: "IDENTITY",
            status: "COMPLETED",
            result: "DISCREPANCY",
            _count: { _all: 2 },
          },
        ]);
      },
    },
    document: {
      groupBy: (input: { where: unknown }) => {
        scopes.push(input.where);
        return Promise.resolve([
          { type: "AADHAAR", status: "REJECTED", _count: { _all: 2 } },
          { type: "AADHAAR", status: "VERIFIED", _count: { _all: 5 } },
        ]);
      },
    },
    qaReview: {
      groupBy: (input: { where: unknown }) => {
        scopes.push(input.where);
        return Promise.resolve([{ decision: "REWORK", _count: { _all: 1 } }]);
      },
    },
  };
  const result = await new DashboardClientService(
    prisma as unknown as PrismaService,
  ).get(actor);

  assert.equal(result.summary.nonClearRate, 20);
  assert.equal(result.summary.rejectedDocuments, 2);
  assert.equal(result.summary.qaRework, 1);
  assert.equal(result.checkHealth[0]?.type, "IDENTITY");
  assert.equal(result.documentHealth[0]?.type, "AADHAAR");
  assert.equal(result.bottleneck?.status, "IN_PROGRESS");
  assert.deepEqual(scopes[0], { tenantId: 1n, clientId: 9n });
  assert.deepEqual(scopes[1], {
    tenantId: 1n,
    case: { tenantId: 1n, clientId: 9n },
  });
  assert.deepEqual(scopes[2], {
    tenantId: 1n,
    case: { tenantId: 1n, clientId: 9n },
  });
  assert.deepEqual(scopes[3], { case: { tenantId: 1n, clientId: 9n } });
});
