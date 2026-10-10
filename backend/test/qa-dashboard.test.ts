import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import { istDayStart, readQaDashboard } from "../src/qa/qa-dashboard";

const now = new Date("2026-10-10T08:00:00Z"); // 13:30 IST
const hours = (value: number) => new Date(now.getTime() - value * 3_600_000);
const actor = {
  tenantId: 1n,
  userId: 40n,
  roles: ["QA_REVIEWER"],
} as unknown as Actor;

const queueRow = (id: string, extra: Record<string, unknown>) => ({
  publicId: id,
  caseNumber: id.toUpperCase(),
  priority: "NORMAL",
  dueAt: null,
  createdAt: hours(100),
  qaReviewerId: null,
  qaClaimedAt: null,
  qaReviewer: null,
  subject: { fullName: `Candidate ${id}` },
  client: { displayName: "Client" },
  checks: [{ riskLevel: null }],
  statusHistory: [],
  ...extra,
});

void test("QA dashboard: SLA, waiting time, reservations, my decisions and rework by type", async () => {
  const prisma = {
    verificationCase: {
      findMany: () => [
        queueRow("a", {
          dueAt: hours(2),
          statusHistory: [{ createdAt: hours(30) }],
        }),
        queueRow("b", {
          dueAt: new Date(now.getTime() + 3_600_000),
          qaReviewerId: 40n,
          qaClaimedAt: hours(0.1),
          statusHistory: [{ createdAt: hours(2) }],
          checks: [{ riskLevel: "HIGH" }],
        }),
        queueRow("c", { qaReviewerId: 41n, qaClaimedAt: hours(0.2) }),
      ],
    },
    qaReview: {
      findMany: () => [
        {
          publicId: "r1",
          decision: "APPROVED",
          createdAt: hours(1),
          caseId: 9n,
          case: {
            publicId: "x",
            caseNumber: "X",
            status: "MANAGER_REVIEW",
            subject: { fullName: "X" },
            client: { displayName: "C" },
          },
        },
        {
          publicId: "r2",
          decision: "REWORK",
          createdAt: hours(50),
          caseId: 9n,
          case: {
            publicId: "x",
            caseNumber: "X",
            status: "IN_PROGRESS",
            subject: { fullName: "X" },
            client: { displayName: "C" },
          },
        },
      ],
      count: () => 5,
    },
    caseStatusHistory: {
      findMany: () => [
        { caseId: 9n, createdAt: hours(3) },
        { caseId: 9n, createdAt: hours(60) },
      ],
    },
    auditEvent: {
      findMany: () => [{ afterJson: JSON.stringify({ checkId: "k1" }) }],
    },
    caseCheck: { findMany: () => [{ type: "EMPLOYMENT" }] },
  } as unknown as PrismaService;
  const view = await readQaDashboard(prisma, actor, now);
  assert.deepEqual(view.queue.sla, {
    overdue: 1,
    dueToday: 1,
    later: 0,
    noDueDate: 1,
  });
  assert.deepEqual(view.queue.waiting, {
    under4h: 1,
    under24h: 0,
    under3d: 1,
    over3d: 1,
  });
  assert.equal(view.queue.mine, 1);
  assert.equal(view.queue.reservedByOthers, 1);
  assert.equal(view.queue.available, 1);
  assert.equal(view.queue.highRisk, 1);
  // My reserved case comes first; someone else's reservation is not offered.
  assert.deepEqual(
    view.upNext.map((row) => row.id),
    ["b", "a"],
  );
  assert.equal(view.me.today, 1);
  assert.equal(view.me.approvalRate, 50);
  // 120 min (r1: entered 3h ago) and 600 min (r2: entered 60h ago, decided 50h ago).
  assert.equal(view.me.medianReviewMinutes, 360);
  assert.equal(view.trend.length, 14);
  assert.equal(view.trend.at(-1)!.approved, 1);
  assert.equal(view.teamToday, 5);
  assert.deepEqual(view.reworkByType, [{ type: "EMPLOYMENT", count: 1 }]);
});

void test("the IST day starts at 18:30 UTC the evening before", () => {
  assert.equal(istDayStart(now).toISOString(), "2026-10-09T18:30:00.000Z");
});
