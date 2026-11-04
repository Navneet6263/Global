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

const web = await load("../src/features/packages/check-catalogue.ts");
const api = await load("../../backend/src/packages/check-catalogue.ts");

test("the builder's catalogue is the backend's: checks, prices, TAT, options, documents", () => {
  assert.deepEqual(web.CHECK_CATALOGUE, api.CHECK_CATALOGUE);
  assert.deepEqual(web.DOCUMENT_LABELS, api.DOCUMENT_LABELS);
});

test("the builder shows the same documents the backend will ask for", () => {
  const checks = ["IDENTITY", "ADDRESS", "EDUCATION", "EMPLOYMENT", "CREDIT_CHECK", "REFERENCE"];
  const raw = {
    IDENTITY: { ids: ["AADHAAR", "PAN"] },
    ADDRESS: { addresses: ["CURRENT", "PERMANENT"] },
    EDUCATION: { levels: ["12TH", "GRADUATION", "POST_GRADUATION"] },
    EMPLOYMENT: { count: 2 },
  };
  const options = web.cleanCheckOptions(raw, checks);
  assert.deepEqual(options, api.cleanCheckOptions(raw, checks));
  assert.deepEqual(
    web.documentPlan(checks, options, ["OTHER"]),
    api.documentPlan(checks, options, ["OTHER"]),
  );
  const plan = web.documentPlan(checks, options);
  // 6 checks: 5 uploads (Aadhaar, PAN shared with CIBIL, address, education, employment).
  assert.equal(plan.totalUploads, 5);
  assert.equal(plan.totalPapers, 9);
  assert.deepEqual(
    plan.noDocument.map((row) => row.type),
    ["REFERENCE"],
  );
});
