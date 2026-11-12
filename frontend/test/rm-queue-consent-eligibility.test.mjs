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
const opsModel = await loadPure("../src/features/operations/workspace/ops-queue-model.ts");

test("RM work model blocks insufficiency and premature workflow actions while consent is pending or draft", () => {
  for (const status of ["DRAFT", "CONSENT_PENDING", "MANAGER_REVIEW", "STOPPED", "CANCELLED"]) {
    assert.equal(rmModel.canRaiseInsufficiency(status), false, status);
  }
  for (const status of ["DRAFT", "CONSENT_PENDING", "STOPPED", "CANCELLED"]) {
    assert.equal(rmModel.nextAction({ status, intakeStage: "INTAKE" }), null, `${status} INTAKE`);
    assert.equal(rmModel.nextAction({ status, intakeStage: "READY" }), null, `${status} READY`);
  }
  assert.equal(
    rmModel.nextAction({ status: "DOCUMENT_PENDING", intakeStage: "CANDIDATE_UPLOAD" }),
    null,
  );
  assert.equal(rmModel.canRaiseInsufficiency("DOCUMENT_PENDING"), true);
  assert.equal(rmModel.canRaiseInsufficiency("IN_PROGRESS"), true);
  assert.deepEqual(rmModel.nextAction({ status: "DOCUMENT_PENDING", intakeStage: "INTAKE" }), {
    label: "Assign Data Entry",
    kind: "data-entry",
  });
  assert.deepEqual(rmModel.nextAction({ status: "DOCUMENT_PENDING", intakeStage: "READY" }), {
    label: "Route checks",
    kind: "route",
  });
});

test("Operations queue model preserves Candidate consent visibility for monitoring views", () => {
  const stage = opsModel.caseStage({
    status: "CONSENT_PENDING",
    workflow: { version: 2, intakeStage: "INTAKE" },
  });
  assert.equal(stage.label, "Consent");
  assert.equal(stage.with, "Candidate");
  assert.deepEqual(
    opsModel.workingWith({
      status: "CONSENT_PENDING",
      workflow: { version: 2, intakeStage: "INTAKE" },
      assignedOpsUser: { publicId: "rm-1", displayName: "Ashish" },
      checks: [],
    }),
    { name: "Candidate", role: "Consent" },
  );
});
