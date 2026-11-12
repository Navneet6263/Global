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

test("getUnifiedDataEntryQueue formats query parameters accurately", async () => {
  const calls = [];
  const client = transpile("../src/lib/backend-api/data-entry-queue.ts", {
    "./client": {
      apiRequest: async (path, init) => {
        calls.push({ path, init });
        return { items: [], total: 0, page: 1, pageSize: 10, counts: {} };
      },
    },
  });

  await client.getUnifiedDataEntryQueue({
    view: "team",
    filter: "l2_reentry",
    search: "Asha",
    page: 2,
    pageSize: 10,
  });
  await client.getUnifiedDataEntryQueue({ view: "mine", filter: "all" });

  assert.equal(
    calls[0].path,
    "/workflow/data-entry/unified-queue?view=team&filter=l2_reentry&search=Asha&page=2&pageSize=10",
  );
  assert.equal(calls[1].path, "/workflow/data-entry/unified-queue?view=mine");
});

test("unified Data Entry UI removes L2 Re-entry header tab and matches backend unified-queue route", () => {
  const insightsCtrl = readFileSync(
    new URL("../../backend/src/workflow/data-entry-insights.controller.ts", import.meta.url),
    "utf8",
  );
  const routeSrc = readFileSync(
    new URL("../src/routes/data-entry.index.tsx", import.meta.url),
    "utf8",
  );

  assert.match(insightsCtrl, /@Get\("unified-queue"\)/);
  assert.doesNotMatch(routeSrc, /tab\s*===\s*"l2-reentry"/);
  assert.doesNotMatch(routeSrc, /DataEntryL2QueuePanel/);
});
