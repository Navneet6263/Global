import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const spoc = await load("../src/features/spoc-rm/vendors/spoc-vendor-model.ts");
const vendor = await load("../src/features/vendor/vendor-request-model.ts");

const attempt = (n, status, extra = {}) => ({
  id: `a${n}`,
  attempt: n,
  status,
  version: 1,
  documentVersion: n + 1,
  vendor: { id: `v${n}`, name: n === 1 ? "Acme Vendors" : "Beta Checks" },
  assignedBy: "Sam SPOC",
  assignedAt: `2026-09-2${n}T10:00:00Z`,
  note: null,
  resolutionNote: null,
  decidedBy: null,
  decidedAt: null,
  reason: null,
  ...extra,
});

test("the history reads assignment, rejection, resolution, re-assignment, then the current status", () => {
  const steps = spoc.historySteps([
    attempt(2, "PENDING", { resolutionNote: "Client uploaded a clear scan" }),
    attempt(1, "REJECTED", {
      reason: "Seal is unreadable",
      decidedBy: "Acme Vendors",
      decidedAt: "2026-09-21T12:00:00Z",
    }),
  ]);
  assert.deepEqual(
    steps.map((step) => step.kind),
    ["assigned", "rejected", "resolution", "reassigned", "pending"],
  );
  assert.equal(steps[1].detail, "Seal is unreadable");
  assert.equal(steps[2].detail, "Client uploaded a clear scan");
  assert.equal(steps[3].title, "Re-assigned to Beta Checks");
  assert.equal(steps[4].title, "Waiting for Beta Checks");
  assert.deepEqual(spoc.historySteps([]), []);
});

test("an approved chain ends with the approval", () => {
  const steps = spoc.historySteps([attempt(1, "APPROVED", { decidedBy: "Acme Vendors" })]);
  assert.deepEqual(
    steps.map((step) => [step.kind, step.title]),
    [
      ["assigned", "Assigned to Acme Vendors"],
      ["approved", "Approved by Acme Vendors"],
    ],
  );
});

test("resolution notes and rejection reasons follow the server's 5 to 1000 character rule", () => {
  for (const text of ["", "    ", "abc", "  ab  "])
    assert.equal(spoc.isValidVendorText(text), false);
  assert.equal(spoc.isValidVendorText("  Fixed  "), true);
  assert.equal(spoc.isValidVendorText("x".repeat(1001)), false);
  assert.match(vendor.decisionProblem("REJECTED", "   "), /at least 5/);
  assert.equal(vendor.decisionProblem("REJECTED", "Seal is unreadable"), null);
  assert.equal(vendor.decisionProblem("APPROVED", ""), null);
  assert.match(vendor.decisionProblem("APPROVED", "x".repeat(1001)), /under 1000/);
});

test("every vendor status has a label and tone, and rejected work stands out", () => {
  assert.deepEqual(Object.keys(spoc.VENDOR_STATUS_META).sort(), [
    "APPROVED",
    "NOT_ASSIGNED",
    "PENDING",
    "REJECTED",
  ]);
  assert.equal(spoc.VENDOR_STATUS_META.REJECTED.tone, "critical");
  assert.equal(vendor.REQUEST_STATUS_META.PENDING.tone, "warning");
  assert.deepEqual(
    vendor.REQUEST_TABS.map((tab) => tab.value),
    ["PENDING", "APPROVED", "REJECTED", "ALL"],
  );
});
