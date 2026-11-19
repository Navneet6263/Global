import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(
  await readFile(
    new URL("../src/features/stakeholders/client/pipeline-model.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

const now = new Date("2026-11-19T06:00:00Z");
const daysAgo = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
const item = (id, status, days = 0, stage = null) => ({
  id,
  status,
  updatedAt: daysAgo(days),
  clientProgress: stage ? { stage } : null,
});

test("each case lands in the client's column; cancelled ones are left off the board", () => {
  assert.equal(model.pipelineColumn(item("a", "CLARIFICATION_PENDING")), "needsYou");
  assert.equal(model.pipelineColumn(item("b", "DOCUMENT_PENDING", 0, "YOUR_REVIEW")), "needsYou");
  assert.equal(model.pipelineColumn(item("c", "DOCUMENT_PENDING")), "candidate");
  assert.equal(model.pipelineColumn(item("d", "IN_PROGRESS")), "verifying");
  assert.equal(model.pipelineColumn(item("e", "MANAGER_REVIEW")), "quality");
  assert.equal(model.pipelineColumn(item("f", "PAYMENT_PENDING")), "release");
  assert.equal(model.pipelineColumn(item("g", "COMPLETED")), "done");
  assert.equal(model.pipelineColumn(item("h", "CANCELLED")), null);
});

test("cases waiting longest come first and are flagged after 5 and 10 days", () => {
  const { columns, hidden } = model.groupPipeline(
    [
      item("new", "IN_PROGRESS", 1),
      item("old", "IN_PROGRESS", 12),
      item("mid", "IN_PROGRESS", 6),
      item("gone", "STOPPED", 30),
    ],
    now,
  );
  assert.deepEqual(
    columns.verifying.map((entry) => entry.id),
    ["old", "mid", "new"],
  );
  assert.equal(hidden, 1);
  assert.equal(model.waitingLevel(item("x", "IN_PROGRESS", 12), now), "late");
  assert.equal(model.waitingLevel(item("y", "IN_PROGRESS", 6), now), "stuck");
  assert.equal(model.waitingLevel(item("z", "COMPLETED", 40), now), "ok");
});
