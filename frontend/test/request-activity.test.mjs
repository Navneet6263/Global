import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/backend-api/request-activity.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { RequestActivity } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);

test("concurrent uploads/downloads keep feedback until each real operation finishes", () => {
  const tracker = new RequestActivity();
  const first = tracker.start("upload");
  const second = tracker.start("upload");
  const download = tracker.start("download");
  assert.deepEqual(tracker.getSnapshot(), { upload: 2, download: 1, write: 0 });
  first();
  first();
  assert.deepEqual(tracker.getSnapshot(), { upload: 1, download: 1, write: 0 });
  download();
  second();
  assert.deepEqual(tracker.getSnapshot(), { upload: 0, download: 0, write: 0 });
});

test("session reset clears activity and late completions cannot clear a new user's request", () => {
  const tracker = new RequestActivity();
  const old = tracker.start("write");
  tracker.reset();
  const current = tracker.start("write");
  old();
  assert.equal(tracker.getSnapshot().write, 1);
  current();
  assert.equal(tracker.getSnapshot().write, 0);
});

test("snapshots are stable and subscriptions release cleanly", () => {
  const tracker = new RequestActivity();
  assert.equal(tracker.getSnapshot(), tracker.getSnapshot());
  let notifications = 0;
  const unsubscribe = tracker.subscribe(() => notifications++);
  const finish = tracker.start("write");
  assert.equal(notifications, 1);
  assert.ok(Object.isFrozen(tracker.getSnapshot()));
  unsubscribe();
  finish();
  assert.equal(notifications, 1);
});
