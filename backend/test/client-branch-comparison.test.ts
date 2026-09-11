import assert from "node:assert/strict";
import test from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import {
  clientBranchComparison,
  clientDashboardScope,
} from "../src/dashboards/client-branch-comparison";

void test("client analytics requires explicit own-client scope even with an admin role", () => {
  assert.throws(
    () => clientDashboardScope({ roles: ["CLIENT_ADMIN"] } as Actor),
    /workspace/,
  );
  assert.deepEqual(
    clientDashboardScope({
      tenantId: 1n,
      clientId: 2n,
      branchId: 3n,
      roles: ["CLIENT_ADMIN", "PLATFORM_ADMIN"],
    } as Actor),
    { tenantId: 1n, clientId: 2n, branchId: 3n },
  );
});

void test("branch comparison keeps client scope and accounts for active, cancelled and unassigned cases", async () => {
  const scope = { tenantId: 1n, clientId: 2n };
  const queries: Array<{ where: Record<string, unknown> }> = [];
  const prisma = {
    verificationCase: {
      groupBy: (input: { by: string[]; where: Record<string, unknown> }) => {
        queries.push(input);
        return input.by.includes("status")
          ? [
              { branchId: 3n, status: "DOCUMENT_PENDING", _count: { _all: 2 } },
              { branchId: 3n, status: "COMPLETED", _count: { _all: 3 } },
              { branchId: 3n, status: "CANCELLED", _count: { _all: 1 } },
              {
                branchId: null,
                status: "PAYMENT_PENDING",
                _count: { _all: 2 },
              },
            ]
          : [{ branchId: 3n, _count: { _all: 1 } }];
      },
    },
    branch: {
      findMany: () => [
        { id: 3n, publicId: "branch", name: "Noida", city: "Noida" },
      ],
    },
  };
  const rows = await clientBranchComparison(
    prisma as unknown as PrismaService,
    scope,
    new Date(),
  );
  for (const query of queries) {
    assert.equal(query.where.tenantId, 1n);
    assert.equal(query.where.clientId, 2n);
  }
  const branch = rows.find((row) => row.id === "branch")!;
  assert.equal(branch.total, 6);
  assert.equal(branch.completed, 3);
  assert.equal(branch.active, 2);
  assert.equal(branch.cancelled, 1);
  assert.equal(branch.completionPercent, 50);
  assert.equal(branch.overdue, 1);
  assert.equal(rows.find((row) => row.id === null)?.name, "Not assigned");
});
