import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(
  await readFile(
    new URL("../src/features/stakeholders/client/client-action-model.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  },
).outputText;
const { clientActionItems, filterClientActions } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const caseRef = { publicId: "case-a", caseNumber: "SG-A", subject: { fullName: "Rani" } };
test("action queue preserves every snapshot item and separates response from review", () => {
  const items = clientActionItems({
    clarifications: Array.from({ length: 15 }, (_, i) => ({
      id: String(i),
      status: i === 14 ? "RESPONDED" : "OPEN",
      subject: "Confirm degree",
      case: caseRef,
    })),
    rejectedDocuments: [{ id: "0", type: "EDUCATION", case: caseRef }],
    overdue: [{ id: "case-a", caseNumber: "SG-A", subject: { fullName: "Rani" } }],
  });
  assert.equal(items.length, 17);
  assert.equal(new Set(items.map((i) => i.id)).size, 17);
  assert.equal(items.filter((i) => i.kind === "review").length, 1);
  assert.equal(filterClientActions(items, "documents", "rAnI").length, 1);
  assert.equal(filterClientActions(items, "", " SG-A ").length, 17);
});
test("resolved clarifications are excluded, and filters do not alter the source", () => {
  const items = clientActionItems({
    clarifications: [{ id: "closed", status: "CLOSED", case: caseRef }],
    rejectedDocuments: [],
    overdue: [],
  });
  assert.deepEqual(items, []);
  assert.deepEqual(filterClientActions(items, "documents", "unknown"), []);
});
