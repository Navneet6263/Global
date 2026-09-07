import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/backend-api/request-scope.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { ApiRequestScope } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("sign-out cancels old reads and rejects late body results", () => {
  const scope = new ApiRequestScope();
  const old = scope.capture();
  scope.reset();
  assert.equal(old.signal.aborted, true);
  assert.throws(old.assertCurrent, { name: "AbortError" });
  assert.doesNotThrow(scope.capture().assertCurrent);
});

test("cancelling a search leaves other reads in the session available", () => {
  const scope = new ApiRequestScope();
  const search = new AbortController();
  const cancelled = scope.capture(search.signal);
  const detail = scope.capture();
  search.abort();
  assert.throws(cancelled.assertCurrent, { name: "AbortError" });
  assert.doesNotThrow(detail.assertCurrent);
});

test("requests have a bounded deadline", async () => {
  const context = new ApiRequestScope().capture(undefined, 1);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.throws(context.assertCurrent, { name: "TimeoutError" });
});
