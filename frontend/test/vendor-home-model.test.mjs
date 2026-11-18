import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/vendor-checks/vendor-home-model.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const now = new Date("2026-11-17T06:00:00Z");
const job = (id, status, extra = {}) => ({
  id,
  status,
  overdue: false,
  dueAt: "2026-11-30T12:00:00Z",
  handler: null,
  ...extra,
});

test("the most urgent work comes first and finished work is left out", () => {
  const actions = model.nextActions(
    [
      job("progress", "IN_PROGRESS"),
      job("soon", "IN_PROGRESS", { dueAt: "2026-11-18T06:00:00Z" }),
      job("new", "ASSIGNED"),
      job("late", "IN_PROGRESS", { overdue: true }),
      job("back", "RETURNED"),
      job("done", "APPROVED"),
      job("sent", "SUBMITTED"),
      job("member", "TEAM_REVIEW", { handler: { id: "u-2", name: "Ravi" } }),
    ],
    "u-1",
    now,
  );
  assert.deepEqual(
    actions.map((action) => action.job.id),
    ["back", "late", "new", "member", "soon", "progress"],
  );
  assert.equal(actions[0].reason, "Sent back: fix and resubmit");
  assert.equal(actions[3].reason, "Review your team member's work");
});

test("a member's own work waiting for the Team Leader is not an action for the member", () => {
  const actions = model.nextActions(
    [job("mine", "TEAM_REVIEW", { handler: { id: "u-2", name: "Ravi" } })],
    "u-2",
    now,
  );
  assert.equal(actions.length, 0);
});

test("headline counts add the right statuses", () => {
  assert.deepEqual(
    model.homeCounts({
      counts: {
        ASSIGNED: 2,
        IN_PROGRESS: 3,
        RETURNED: 1,
        TEAM_REVIEW: 1,
        SUBMITTED: 2,
        APPROVED: 9,
      },
      overdue: 1,
    }),
    { toAccept: 2, working: 4, overdue: 1, inReview: 3, done: 9 },
  );
});

test("months move across the year end and follow India time", () => {
  assert.equal(model.shiftMonth("2026-12", 1), "2027-01");
  assert.equal(model.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(model.monthLabel("2026-11"), "November 2026");
  assert.equal(model.currentIstMonth(new Date("2026-10-31T18:40:00Z")), "2026-11");
});
