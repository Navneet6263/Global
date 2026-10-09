import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadPure(path) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const flow = await loadPure("../src/features/workflow-ui/flow-model.ts");
const queue = await loadPure("../src/features/operations/workspace/ops-queue-model.ts");

const row = (overrides = {}) => ({
  status: "DOCUMENT_PENDING",
  intakeStage: "INTAKE",
  rm: { id: "rm", name: "Riya Mehta" },
  dataEntry: { id: "de", name: "Sara Khan" },
  openInsufficiency: { l1: 0, l2: 0 },
  checks: { total: 2, completed: 0, unassigned: 0, departments: [] },
  ...overrides,
});

test("flow position names the step and who holds the case", () => {
  assert.deepEqual(flow.flowPosition(row()), {
    label: "Assign Data Entry",
    holder: "Riya Mehta",
    tone: "warn",
  });
  assert.equal(flow.flowPosition(row({ intakeStage: "DATA_ENTRY" })).holder, "Sara Khan");
  assert.equal(flow.flowPosition(row({ intakeStage: "CORRECTION" })).label, "Correction (L1)");
  assert.equal(flow.flowPosition(row({ intakeStage: "READY" })).label, "Ready to route");
  assert.deepEqual(
    flow.flowPosition(
      row({
        status: "IN_PROGRESS",
        intakeStage: "ROUTED",
        checks: { total: 2, completed: 0, unassigned: 1, departments: ["Employment"] },
      }),
    ),
    { label: "Awaiting team member", holder: "Employment", tone: "warn" },
  );
  assert.equal(
    flow.flowPosition(
      row({ status: "IN_PROGRESS", intakeStage: "ROUTED", openInsufficiency: { l1: 0, l2: 1 } }),
    ).label,
    "Insufficiency (L2)",
  );
  assert.equal(
    flow.flowPosition(row({ status: "MANAGER_REVIEW", intakeStage: "ROUTED" })).label,
    "Final approval",
  );
});

test("routing defaults keep an earlier choice, else use the department suggestion", () => {
  assert.deepEqual(
    flow.defaultRoutes([
      { id: "a", status: "PENDING", department: { id: "d1" }, suggestedDepartmentId: "d2" },
      { id: "b", status: "PENDING", department: null, suggestedDepartmentId: "d3" },
      { id: "c", status: "PENDING", department: null, suggestedDepartmentId: null },
      { id: "d", status: "COMPLETED", department: null, suggestedDepartmentId: "d4" },
    ]),
    { a: "d1", b: "d3", c: "" },
  );
});

test("due labels mark overdue red and near due amber", () => {
  const now = Date.parse("2026-10-06T10:00:00Z");
  assert.deepEqual(flow.dueLabel("2026-10-06T08:00:00Z", now), { text: "Overdue 2h", tone: "bad" });
  assert.equal(flow.dueLabel("2026-10-06T14:00:00Z", now).tone, "warn");
  assert.equal(flow.dueLabel("2026-10-08T10:00:00Z", now).tone, "good");
  assert.equal(flow.dueLabel(null, now).text, "No due date");
});

test("Operations stage and owner follow the v2 intake steps", () => {
  const base = {
    status: "DOCUMENT_PENDING",
    checks: [],
    assignedOpsUser: { publicId: "rm", displayName: "Riya Mehta" },
    workflow: {
      version: 2,
      intakeStage: "DATA_ENTRY",
      dataEntryUser: { publicId: "de", displayName: "Sara Khan" },
    },
  };
  assert.equal(queue.caseStage(base).label, "Data Entry");
  assert.deepEqual(queue.workingWith(base), { name: "Sara Khan", role: "Data Entry" });
  const ready = { ...base, workflow: { ...base.workflow, intakeStage: "READY" } };
  assert.equal(queue.caseStage(ready).label, "Ready to route");
  assert.equal(queue.workingWith(ready).name, "Riya Mehta");
  const legacy = { ...base, workflow: { version: 1, intakeStage: null, dataEntryUser: null } };
  assert.equal(queue.caseStage(legacy).label, "Documents");
  const routed = {
    status: "IN_PROGRESS",
    assignedOpsUser: null,
    workflow: { version: 2, intakeStage: "ROUTED", dataEntryUser: null },
    checks: [
      {
        status: "PENDING",
        department: { publicId: "d", name: "Employment" },
        tasks: [{ status: "UNASSIGNED", assignee: null }],
      },
    ],
  };
  assert.deepEqual(queue.workingWith(routed), {
    name: "Employment team",
    role: "Awaiting Team Leader",
  });
});
