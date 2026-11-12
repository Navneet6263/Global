import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(relPath, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL(relPath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const require = (id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unmocked import ${id}`);
  };
  new Function("require", "exports", code)(require, exports);
  return exports;
}

test("resolveInitialStep selects the first incomplete step once on load", () => {
  const readiness = transpile("../src/features/delivery/verifier/verification-readiness.ts", {
    "@tanstack/react-query": { useQuery: () => ({}) },
    "@/lib/backend-api/check-evidence": { checkEvidenceApi: { list: () => Promise.resolve({}) } },
    "@/lib/backend-api/verified-details": { getVerifiedDetails: () => Promise.resolve({}) },
  });

  assert.equal(readiness.MIN_SUMMARY, 20);
  assert.deepEqual(readiness.STEP_ORDER, ["details", "proof", "outcome", "review"]);
  assert.equal(
    readiness.resolveInitialStep({ detailsDone: false, proofDone: false, outcomeDone: false }),
    "details",
  );
  assert.equal(
    readiness.resolveInitialStep({ detailsDone: true, proofDone: false, outcomeDone: false }),
    "proof",
  );
  assert.equal(
    readiness.resolveInitialStep({ detailsDone: true, proofDone: true, outcomeDone: false }),
    "outcome",
  );
  assert.equal(
    readiness.resolveInitialStep({ detailsDone: true, proofDone: true, outcomeDone: true }),
    "review",
  );
});

test("VerifierTaskWorkspace latches initial step instead of falling through on summary edits", () => {
  const workspaceSource = readFileSync(
    new URL("../src/features/delivery/verifier/VerifierTaskWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    workspaceSource,
    /if \(!inProgress \|\| chosenStep !== null \|\| readiness\.loading \|\| !draft\.draftReady\) return;/,
  );
  assert.match(workspaceSource, /setChosenStep\(\s*resolveInitialStep\(/);
  assert.match(workspaceSource, /const step: StepId = chosenStep \?\? "details";/);
  assert.doesNotMatch(workspaceSource, /!outcomeDone\s*\?\s*"outcome"\s*:\s*"review"/);
});
