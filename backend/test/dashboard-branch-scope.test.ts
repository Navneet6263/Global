import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { DashboardExceptionsService } from "../src/dashboards/dashboard-exceptions.service";
import { DashboardsService } from "../src/dashboards/dashboards.service";

void test("Operations trend and risk filters preserve branch and unassigned intake scope", async () => {
  const filters: Array<Record<string, unknown>> = [];
  const database = {
    verificationCase: {
      groupBy: ({ where }: { where: Record<string, unknown> }) => {
        if (where.status) filters.push(where);
        return Promise.resolve([]);
      },
      count: () => Promise.resolve(0),
      findMany: ({
        where,
        select,
      }: {
        where: Record<string, unknown>;
        select: Record<string, unknown>;
      }) => {
        if (select.completedAt) filters.push(where);
        return Promise.resolve([]);
      },
    },
    caseCheck: { groupBy: () => Promise.resolve([]) },
  } as unknown as PrismaService;
  await new DashboardsService(
    database,
    {} as DashboardExceptionsService,
  ).operations({
    userId: 1n,
    tenantId: 2n,
    branchId: 23n,
    roles: ["OPS_MANAGER"],
  } as Actor);
  assert.equal(filters.length, 2);
  for (const filter of filters) {
    const conditions = filter.AND as unknown[];
    assert.deepEqual(conditions[0], {
      tenantId: 2n,
      OR: [{ branchId: 23n }, { branchId: null }],
    });
    assert.ok(conditions[1]);
  }
});
