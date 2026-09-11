import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/features/operations/dispatch/dispatch-api.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const requests = [];
new Function("require", "exports", code)(
  () => ({
    apiRequest: (...args) => {
      requests.push(args);
      return Promise.resolve({});
    },
  }),
  exports,
);

const record = {
  id: "case-1",
  version: 4,
  ready: true,
  eligibleVerifierIds: ["verifier-1"],
  checks: [
    { id: "check-1", type: "IDENTITY", checkVersion: 2 },
    { id: "check-2", type: "EDUCATION", checkVersion: 1, taskId: "task-1", version: 3 },
  ],
};

test("allocation body contains only supported DTO fields and optimistic versions", () => {
  const body = exports.buildDispatchBody(
    record,
    { "check-1": "verifier-1", "check-2": "verifier-1" },
    "operation-1",
    "  Review source  ",
  );
  assert.equal(body.instructions, "Review source");
  assert.equal(body.version, 4);
  assert.deepEqual(body.allocations, [
    { checkId: "check-1", checkVersion: 2, assigneeId: "verifier-1" },
    { checkId: "check-2", checkVersion: 1, assigneeId: "verifier-1", taskId: "task-1", version: 3 },
  ]);
});

test("client cannot construct a plan missing a check or with an ineligible owner", () => {
  assert.throws(
    () => exports.buildDispatchBody(record, { "check-1": "verifier-1" }, "operation-1", ""),
    /every check/,
  );
  assert.throws(
    () =>
      exports.buildDispatchBody(
        record,
        { "check-1": "other", "check-2": "other" },
        "operation-1",
        "",
      ),
    /eligible/,
  );
  assert.throws(
    () => exports.buildDispatchBody({ ...record, ready: false }, {}, "operation-1", ""),
    /not ready/,
  );
});

test("retry uses the caller's stable operation and idempotency keys", async () => {
  const body = exports.buildDispatchBody(
    record,
    { "check-1": "verifier-1", "check-2": "verifier-1" },
    "stable-operation",
    "",
  );
  await exports.commitDispatch(record.id, body, "stable-key");
  await exports.commitDispatch(record.id, body, "stable-key");
  assert.deepEqual(requests.at(-1), requests.at(-2));
  assert.equal(requests.at(-1)[1].headers["Idempotency-Key"], "stable-key");
});

test("batch concurrency never exceeds two and every case is processed once", async () => {
  let concurrent = 0;
  let max = 0;
  const seen = [];
  await exports.runDispatchBatch([1, 2, 3, 4, 5], async (id) => {
    concurrent++;
    max = Math.max(max, concurrent);
    seen.push(id);
    await new Promise((resolve) => setTimeout(resolve, 2));
    concurrent--;
  });
  assert.equal(max, 2);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
});

test("unmount/session navigation prevents further queued cases from being sent", async () => {
  let active = true;
  const seen = [];
  await exports.runDispatchBatch(
    [1, 2, 3],
    async (id) => {
      seen.push(id);
      active = false;
    },
    () => active,
  );
  assert.deepEqual(seen, [1]);
});
