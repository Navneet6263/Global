import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(
  new URL("../src/features/stakeholders/client/client-export-model.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
test("export follows selected column order and omits all unselected data", () => {
  const csv = model.exportCsv(
    [{ candidate: "Rani", status: "COMPLETE", hidden: "private" }],
    [
      { key: "status", label: "Stage" },
      { key: "candidate", label: "Candidate" },
    ],
  );
  assert.equal(csv, '\uFEFF"Stage","Candidate"\r\n"COMPLETE","Rani"');
  assert.ok(!csv.includes("private"));
  assert.throws(() => model.exportCsv([], [{ key: "status", label: "Stage" }]));
});
test("CSV preserves quoted multiline values and neutralises spreadsheet formulas", () => {
  assert.equal(model.csvCell('A,"B"\nC'), '"A,""B""\nC"');
  for (const text of ["=HYPERLINK(1)", "  @SUM(1)", "\t+1", "-1+1", "\r=1"])
    assert.ok(model.csvCell(text).startsWith("\"'"));
  assert.equal(model.csvCell(-12.5), '"-12.5"');
});
test("column reordering is immutable and respects the boundaries", () => {
  const keys = ["a", "b", "c"];
  assert.deepEqual(model.moveColumn(keys, 1, -1), ["b", "a", "c"]);
  assert.deepEqual(model.moveColumn(keys, 2, 1), keys);
  assert.deepEqual(keys, ["a", "b", "c"]);
});
test("date ranges validate calendar dates and include full India calendar days", () => {
  assert.throws(() => model.validateExportFilters({ from: "2026-02-30", to: "" }));
  assert.throws(() => model.validateExportFilters({ from: "2026-10-02", to: "2026-10-01" }));
  const filters = { from: "2026-10-01", to: "2026-10-01" };
  assert.equal(model.inDateRange("2026-09-30T18:30:00Z", filters), true);
  assert.equal(model.inDateRange("2026-10-01T18:29:59Z", filters), true);
  assert.equal(model.inDateRange("2026-10-01T18:30:00Z", filters), false);
  assert.equal(model.inDateRange(null, filters), false);
});
test("expense summaries keep currencies separate, exclude cancellations and retain credits", () => {
  const row = { currency: "INR", billed: 100.1, paid: 20, credited: 10, balance: 70.1 };
  const result = model.expenseSummary([
    row,
    row,
    { ...row, currency: "USD" },
    { ...row, status: "CANCELLED" },
  ]);
  assert.deepEqual(result[0], {
    currency: "INR",
    count: 2,
    billed: 200.2,
    paid: 40,
    credited: 20,
    balance: 140.2,
  });
  assert.equal(result[1].currency, "USD");
  assert.equal(result[1].count, 1);
});
