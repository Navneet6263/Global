import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/formatting/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { daysToHours, formatTatDays, hoursToDays } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("turnaround is entered in days and still saved in hours", () => {
  assert.equal(daysToHours(3), 72);
  assert.equal(daysToHours(0.5), 12);
  assert.equal(daysToHours(365), 8760);
  assert.equal(hoursToDays(72), 3);
  assert.equal(hoursToDays(36), 1.5);
});

test("turnaround reads as days", () => {
  assert.equal(formatTatDays(24), "1 day");
  assert.equal(formatTatDays(120), "5 days");
  assert.equal(formatTatDays(36), "1.5 days");
});
