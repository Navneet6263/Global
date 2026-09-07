import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/auth/device-operation-queue.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { DeviceOperationQueue } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("a new offline owner waits until previous cleanup finishes, including failure", async () => {
  const queue = new DeviceOperationQueue();
  const events = [];
  let finish;
  const cleanup = queue.run(async () => {
    events.push("cleanup started");
    await new Promise((resolve) => {
      finish = resolve;
    });
    events.push("cleanup finished");
    throw new Error("one store failed");
  });
  const checked = assert.rejects(cleanup, /one store failed/);
  const prepare = queue.run(async () => {
    events.push("new owner prepared");
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ["cleanup started"]);
  finish();
  await checked;
  await prepare;
  assert.deepEqual(events, ["cleanup started", "cleanup finished", "new owner prepared"]);
});
