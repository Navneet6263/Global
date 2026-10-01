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
const model = await loadPure("../src/features/stakeholders/client/client-queue-model.ts");
const backend = await loadPure("../../backend/src/cases/case.constants.ts");

test("client stages match accepted backend statuses without grouping cancellations as completed", () => {
  assert.deepEqual(
    model.clientStages.map((item) => item.value),
    [...backend.CaseStatuses],
  );
  assert.equal(model.clientStages.find((item) => item.value === "CANCELLED").label, "Cancelled");
});
test("URL filters reject unsupported statuses and malformed pages", () => {
  for (const page of [-1, 0, 1.2, Infinity, "no", [], {}, 100001]) {
    assert.equal(model.parseClientQueueSearch({ page }).page, undefined);
  }
  assert.deepEqual(model.parseClientQueueSearch({ page: "2", status: "QA_REVIEW", q: " Rani " }), {
    page: 2,
    status: "QA_REVIEW",
    q: "Rani",
    caseId: undefined,
    pageSize: undefined,
  });
  assert.equal(
    model.parseClientQueueSearch({ status: "fake", q: " ", caseId: {} }).status,
    undefined,
  );
  assert.equal(model.parseClientQueueSearch({ q: "a".repeat(200) }).q.length, 120);
});
test("queue query never accepts a client or tenant scope from URL input", () => {
  const query = model.clientQueueQuery(
    model.parseClientQueueSearch({
      clientId: "another-client",
      tenantId: "another-tenant",
      page: 2,
      status: "COMPLETED",
    }),
  );
  assert.deepEqual(query, {
    search: undefined,
    status: "COMPLETED",
    page: 2,
    pageSize: 6,
    limit: 6,
    sortBy: "updatedAt",
    sortDir: "desc",
  });
});
test("pagination describes the last and empty pages correctly", () => {
  assert.equal(model.queueRange(1, 6, 23), "1–6 of 23 cases");
  assert.equal(model.queueRange(4, 5, 23), "19–23 of 23 cases");
  assert.equal(model.queueRange(4, 0, 23), "0 of 23 cases");
});

test("rows per page accepts only supported sizes", () => {
  assert.equal(model.parseClientQueueSearch({ pageSize: "12" }).pageSize, 12);
  for (const pageSize of [0, -1, 100, "all", {}])
    assert.equal(model.parseClientQueueSearch({ pageSize }).pageSize, undefined);
  assert.equal(model.queueRange(2, 11, 23, 12), "13–23 of 23 cases");
});
