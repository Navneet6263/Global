import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/cases/case-workflow-summary.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { caseWorkflowSummary: summarize } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const assignee = { displayName: "Test Verifier", email: "verifier@example.invalid" };
const base = {
  status: "IN_PROGRESS",
  subject: { fullName: "Test Candidate" },
  checks: [],
  fieldVisits: [],
};
const check = (type, status = "ASSIGNED", task = {}) => ({
  type,
  status,
  tasks: [{ status: "OPEN", assignee, createdAt: "2026-09-14T06:00:00Z", ...task }],
});

test("approved field visit does not hide remaining verifier checks", () => {
  const result = summarize({
    ...base,
    checks: [
      check("ADDRESS", "COMPLETED"),
      check("EDUCATION", "COMPLETED"),
      check("IDENTITY"),
      check("EMPLOYMENT"),
    ],
    fieldVisits: [{ status: "COMPLETED" }],
  });
  assert.equal(result.field, "Field visit approved");
  assert.equal(result.completedChecks, 2);
  assert.equal(result.pending.length, 2);
  assert.ok(
    result.pending.every((row) => row.role === "Verifier" && row.owner.includes(assignee.email)),
  );
  assert.match(result.pending[0].reason, /not started/);
  assert.match(result.next, /QA review follows only after/);
});

test("field and verifier work may be pending simultaneously", () => {
  const result = summarize({
    ...base,
    checks: [check("ADDRESS")],
    fieldVisits: [{ status: "IN_PROGRESS", assignee, createdAt: "2026-09-14T06:00:00Z" }],
  });
  assert.deepEqual(
    result.pending.map((row) => row.role),
    ["Verifier", "Field executive"],
  );
});

test("required field assignment and evidence approval belong to operations", () => {
  const item = { ...base, checks: [check("ADDRESS", "COMPLETED")] };
  assert.match(summarize(item).pending[0].reason, /Assign required physical/);
  for (const status of ["REVIEW_PENDING", "EXCEPTION_REVIEW"]) {
    const result = summarize({ ...item, fieldVisits: [{ status }] });
    assert.equal(result.pending[0].role, "Operations");
    assert.match(result.pending[0].reason, /Review field photos/);
  }
  assert.match(
    summarize({ ...item, fieldVisits: [{ status: "CANCELLED" }] }).pending[0].reason,
    /Assign required physical/,
  );
});

test("blocked work and unassigned tasks are not called QA ready", () => {
  const blocked = summarize({
    ...base,
    checks: [
      check("IDENTITY", "ASSIGNED", { status: "BLOCKED", blockerReason: "Need readable proof" }),
    ],
  });
  assert.match(blocked.pending[0].reason, /Need readable proof/);
  const unassigned = summarize({
    ...base,
    checks: [check("IDENTITY", "ASSIGNED", { assignee: null })],
  });
  assert.equal(unassigned.pending[0].role, "Operations");
  const stale = summarize({ ...base, checks: [check("IDENTITY", "COMPLETED")] });
  assert.equal(stale.pending[0].role, "Operations");
  assert.match(stale.pending[0].reason, /readiness/);
});

test("post-verification stages and terminal cases remain distinct", () => {
  const qa = summarize({ ...base, status: "QA_REVIEW", qaReviewer: assignee });
  assert.match(qa.pending[0].owner, /verifier@example.invalid/);
  for (const [status, role] of [
    ["CONSENT_PENDING", "Candidate"],
    ["DOCUMENT_PENDING", "Operations"],
    ["QA_REVIEW", "QA reviewer"],
    ["MANAGER_REVIEW", "Manager"],
    ["REPORT_PENDING", "Report processing"],
    ["PAYMENT_PENDING", "Finance / release"],
  ]) {
    assert.equal(summarize({ ...base, status }).pending[0].role, role);
  }
  for (const status of ["COMPLETED", "CLOSED", "CANCELLED"]) {
    const result = summarize({ ...base, status, checks: [check("IDENTITY")] });
    assert.equal(result.closed, true);
    assert.equal(result.pending.length, 0);
  }
});
