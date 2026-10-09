import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../src/database/prisma.service";
import { IntakeService } from "../src/workflow/intake.service";
import { testActor } from "./helpers/test-actor";

void test("RM overview numbers and client pulse use the RM's own cases only", async () => {
  const wheres: unknown[] = [];
  const prisma = {
    verificationCase: {
      findMany: () => Promise.resolve([]),
      count: (args: { where: unknown }) => {
        wheres.push(args.where);
        return Promise.resolve(2);
      },
      groupBy: (args: { where: { dueAt?: unknown } }) =>
        Promise.resolve(
          args.where.dueAt
            ? [{ clientId: 21n, _count: { _all: 1 } }]
            : [
                { clientId: 22n, _count: { _all: 1 } },
                { clientId: 21n, _count: { _all: 5 } },
              ],
        ),
    },
    client: {
      findMany: () =>
        Promise.resolve([
          { id: 21n, publicId: "c-21", displayName: "Northstar Labs" },
          { id: 22n, publicId: "c-22", displayName: "Cedar Retail" },
        ]),
    },
  } as unknown as PrismaService;
  const rm = testActor(["SPOC_RM"], ["case:read"], {
    spocClients: [{ id: 21n, publicId: "c-21", name: "Northstar Labs" }],
  });
  const result = await new IntakeService(prisma).rmQueue(rm, {});
  assert.deepEqual(result.summary, {
    active: 2,
    overdue: 2,
    dueToday: 2,
    completedThisWeek: 2,
    escalated: 2,
    // Busiest client first, with its overdue count.
    clients: [
      { id: "c-21", name: "Northstar Labs", active: 5, overdue: 1 },
      { id: "c-22", name: "Cedar Retail", active: 1, overdue: 0 },
    ],
  });
  // Every count is limited to cases this RM owns.
  for (const where of wheres)
    assert.equal(
      (where as { assignedOpsUserId?: unknown }).assignedOpsUserId,
      rm.userId,
    );
});
