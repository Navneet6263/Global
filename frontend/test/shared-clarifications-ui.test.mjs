import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function transpile(relPath, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL(relPath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((id) => {
    if (id in mocks) return mocks[id];
    throw new Error(`Unmocked import ${id}`);
  }, exports);
  return exports;
}

test("clarifications-shared routes Ops and RM modes to synchronized endpoints", async () => {
  const calls = [];
  const shared = transpile("../src/lib/backend-api/clarifications-shared.ts", {
    "./client": {
      apiRequest: async (path, init) => {
        calls.push({ path, init });
        return { ok: true };
      },
    },
  });

  await shared.getSharedL2Clarifications("ops", { status: "CANDIDATE_SUBMITTED", search: "SG-1" });
  await shared.getSharedL2Clarifications("rm", { status: "ALL", limit: 25 });
  await shared.completeSharedL2Clarification("ops", "c-1", { dataEntryUserId: "de-1" });
  await shared.completeSharedL2Clarification("rm", "c-1", { dataEntryUserId: "de-2", note: "OK" });
  await shared.getSharedL1Clarifications("ops", { state: "overdue", search: "pan" });
  await shared.getSharedL1Clarifications("rm", { state: "response_received" });
  await shared.resolveSharedClarification("ops", "case-1", "c-2", "Closed");
  await shared.resolveSharedClarification("rm", "case-1", "c-2", "Verified");

  assert.equal(
    calls[0].path,
    "/clarifications/l2/ops-queue?status=CANDIDATE_SUBMITTED&search=SG-1",
  );
  assert.equal(calls[1].path, "/workflow/clarifications/rm-l2-queue?status=ALL&limit=25");
  assert.equal(calls[2].path, "/clarifications/c-1/ops-complete");
  assert.equal(calls[3].path, "/workflow/clarifications/c-1/rm-handoff");
  assert.equal(calls[4].path, "/clarifications/l1-queue?state=overdue&search=pan");
  assert.equal(calls[5].path, "/workflow/clarifications/rm-l1-queue?state=response_received");
  assert.equal(calls[6].path, "/cases/case-1/clarifications/c-2/resolve");
  assert.equal(calls[6].init.method, "PATCH");
  assert.equal(calls[7].path, "/workflow/cases/case-1/clarifications/c-2/rm-resolve");
  assert.equal(calls[7].init.method, "PATCH");
});

test("invalidateWorkflow covers workflow & clarifications roots and RM corrections workspace unifies cases, L2 & L1 in tabs", () => {
  const invSrc = readFileSync(
    new URL("../src/lib/api/invalidate-workflow.ts", import.meta.url),
    "utf8",
  );
  assert.match(invSrc, /"workflow"/);
  assert.match(invSrc, /"clarifications"/);

  const navSrc = readFileSync(new URL("../src/config/navigation.spoc.ts", import.meta.url), "utf8");
  assert.match(navSrc, /"Corrections & queries"[\s\S]*"rmClarifications"/);

  const rmModel = transpile("../src/features/workflow-ui/rm-queue-model.ts", {});
  assert.equal(rmModel.resolveCorrectionTab(undefined), "cases");
  assert.equal(rmModel.resolveCorrectionTab("cases"), "cases");
  assert.equal(rmModel.resolveCorrectionTab("l2"), "l2");
  assert.equal(rmModel.resolveCorrectionTab("l1"), "l1");
  assert.equal(rmModel.resolveCorrectionTab("unknown"), "cases");

  const rmQueueSrc = readFileSync(
    new URL("../src/features/workflow-ui/RmWorkQueue.tsx", import.meta.url),
    "utf8",
  );
  assert.match(rmQueueSrc, /search\.bucket === "correction" \? \(\s*<RmCorrectionsWorkspace/);
  assert.doesNotMatch(rmQueueSrc, /<RmCorrectionsWorkspace \/>/);

  const workspaceSrc = readFileSync(
    new URL("../src/features/workflow-ui/RmCorrectionsWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workspaceSrc, /activeTab === "cases" \? casesView : null/);
  assert.match(
    workspaceSrc,
    /activeTab === "l2" \? <SharedL2ClarificationsPanel mode="rm" embedded \/> : null/,
  );
  assert.match(
    workspaceSrc,
    /activeTab === "l1" \? <SharedL1ClarificationsPanel mode="rm" embedded \/> : null/,
  );

  const routeSrc = readFileSync(new URL("../src/routes/spoc-rm.work.tsx", import.meta.url), "utf8");
  assert.match(routeSrc, /tab:\s*input\["tab"\] === "l2" \|\| input\["tab"\] === "l1"/);
  assert.match(routeSrc, /if \(next\.bucket !== "correction"\) next\.tab = undefined;/);

  const opsSrc = readFileSync(
    new URL("../src/routes/operations.clarifications.tsx", import.meta.url),
    "utf8",
  );
  assert.match(opsSrc, /<SharedL2ClarificationsPanel mode="ops" \/>/);
  assert.match(opsSrc, /<SharedL1ClarificationsPanel mode="ops" \/>/);
});
