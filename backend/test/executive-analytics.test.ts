import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attentionQueue,
  caseStats,
  type ExecutiveCaseRow,
} from "../src/dashboards/executive-analytics.helpers";

const now = new Date("2026-08-25T12:00:00.000Z");

function row(overrides: Partial<ExecutiveCaseRow> = {}): ExecutiveCaseRow {
  return {
    publicId: "00000000-0000-4000-8000-000000000001",
    caseNumber: "SG-0001",
    status: "IN_PROGRESS",
    priority: "NORMAL",
    riskLevel: "LOW",
    createdAt: new Date("2026-08-20T12:00:00.000Z"),
    updatedAt: new Date("2026-08-24T12:00:00.000Z"),
    dueAt: new Date("2026-08-24T12:00:00.000Z"),
    completedAt: null,
    subject: { fullName: "Test Candidate" },
    client: { publicId: "00000000-0000-4000-8000-000000000002", displayName: "Client" },
    branch: null,
    assignedOpsUser: null,
    checks: [],
    clarifications: [],
    fieldVisits: [],
    ...overrides,
  };
}

void test("executive SLA excludes completed cases without a due date", () => {
  const rows = [
    row({ status: "COMPLETED", completedAt: new Date("2026-08-23T12:00:00.000Z") }),
    row({ publicId: "00000000-0000-4000-8000-000000000003", status: "COMPLETED", dueAt: null, completedAt: new Date("2026-08-23T12:00:00.000Z") }),
  ];
  const stats = caseStats(rows, now);
  assert.equal(stats.completed, 2);
  assert.equal(stats.slaPercentage, 100);
  assert.equal(stats.overdue, 0);
});

void test("attention queue prioritises overdue critical work", () => {
  const low = row({ publicId: "00000000-0000-4000-8000-000000000004", dueAt: null, clarifications: [{ status: "OPEN" }] });
  const critical = row({ publicId: "00000000-0000-4000-8000-000000000005", riskLevel: "CRITICAL" });
  const queue = attentionQueue([low, critical], now);
  assert.equal(queue[0]?.id, critical.publicId);
  assert.equal(queue[0]?.severity, 3);
  assert.deepEqual(queue[0]?.reasons, ["Overdue", "CRITICAL risk"]);
});
