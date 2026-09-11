import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function pureModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

const checks = await pureModule("../src/lib/contracts/check.ts");
const statuses = await pureModule("../src/lib/api/http/dashboard-stage-map.ts");
const client = await pureModule("../src/features/stakeholders/client/client-portal-utils.ts");
const backend = await pureModule("../../backend/src/cases/case.constants.ts");

test("every supported backend check preserves its identity and display label", () => {
  for (const type of backend.CheckTypes) {
    assert.equal(checks.normalizeCheckType(type), type.toLowerCase(), type);
    assert.notEqual(checks.checkLabel(type), "Other", type);
  }
  assert.equal(checks.normalizeCheckType("UNRECOGNISED_TYPE"), "other");
  assert.equal(checks.checkLabel("UNRECOGNISED_TYPE"), "UNRECOGNISED TYPE");
});

test("manager, report and payment waits never appear as completed", () => {
  const stages = [
    ["MANAGER_REVIEW", "manager_review", 91],
    ["REPORT_PENDING", "report_pending", 94],
    ["PAYMENT_PENDING", "payment_pending", 97],
  ];
  for (const [status, stage, progress] of stages) {
    assert.equal(statuses.dashboardStageMap[status], stage);
    assert.equal(client.caseProgress({ status, checks: [{ status: "COMPLETED" }] }), progress);
    assert.equal(client.terminalCaseStatuses.has(status), false);
    assert.notEqual(client.caseStatusLabel(status), "Verification completed");
  }
  assert.equal(client.caseProgress({ status: "COMPLETED", checks: [] }), 100);
});
