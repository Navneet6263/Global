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

const rmModel = await loadPure("../src/features/workflow-ui/rm-queue-model.ts");
const flowModel = await loadPure("../src/features/workflow-ui/flow-model.ts");

test("isBulkDataEntryEligible accepts only DOCUMENT_PENDING + INTAKE cases with assigned RM", () => {
  assert.equal(rmModel.MAX_BULK_DATA_ENTRY, 50);
  assert.equal(
    rmModel.isBulkDataEntryEligible({
      status: "DOCUMENT_PENDING",
      intakeStage: "INTAKE",
      rm: { id: "rm-1", name: "Ashish" },
    }),
    true,
  );

  for (const ineligible of [
    {
      status: "CONSENT_PENDING",
      intakeStage: "CANDIDATE_UPLOAD",
      rm: { id: "rm-1", name: "Ashish" },
    },
    {
      status: "DOCUMENT_PENDING",
      intakeStage: "CANDIDATE_UPLOAD",
      rm: { id: "rm-1", name: "Ashish" },
    },
    {
      status: "DOCUMENT_PENDING",
      intakeStage: "CLIENT_REVIEW",
      rm: { id: "rm-1", name: "Ashish" },
    },
    { status: "DOCUMENT_PENDING", intakeStage: "DATA_ENTRY", rm: { id: "rm-1", name: "Ashish" } },
    { status: "DOCUMENT_PENDING", intakeStage: "READY", rm: { id: "rm-1", name: "Ashish" } },
    { status: "STOPPED", intakeStage: "INTAKE", rm: { id: "rm-1", name: "Ashish" } },
    { status: "DOCUMENT_PENDING", intakeStage: "INTAKE", rm: null },
  ]) {
    assert.equal(rmModel.isBulkDataEntryEligible(ineligible), false);
  }
});

test("flowPosition renders Candidate upload pending for CANDIDATE_UPLOAD stage", () => {
  assert.deepEqual(
    flowModel.flowPosition({
      status: "DOCUMENT_PENDING",
      intakeStage: "CANDIDATE_UPLOAD",
      workflowVersion: 2,
    }),
    { label: "Candidate upload pending", holder: "Candidate", tone: "info" },
  );
});
