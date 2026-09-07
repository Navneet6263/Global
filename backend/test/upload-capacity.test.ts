import assert from "node:assert/strict";
import { test } from "node:test";
import { UploadCapacity } from "../src/common/http/upload-capacity";

void test("upload capacity bounds concurrent buffering and releases permits after failures", async () => {
  const capacity = new UploadCapacity();
  let finish!: () => void;
  const held = capacity.run(
    "actor-a",
    2,
    1,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await assert.rejects(
    capacity.run("actor-a", 2, 1, () => Promise.resolve("never")),
    /busy/,
  );
  assert.equal(
    await capacity.run("actor-b", 2, 1, () => Promise.resolve("accepted")),
    "accepted",
  );
  await assert.rejects(
    capacity.run("actor-b", 2, 1, () =>
      Promise.reject(new Error("inspection failed")),
    ),
    /inspection failed/,
  );
  assert.equal(
    await capacity.run("actor-b", 2, 1, () => Promise.resolve("retry")),
    "retry",
  );
  finish();
  await held;
  assert.equal(
    await capacity.run("actor-a", 2, 1, () => Promise.resolve("released")),
    "released",
  );
});

void test("global upload limit rejects before executing or buffering another file", async () => {
  const capacity = new UploadCapacity();
  let finish!: () => void;
  const held = capacity.run(
    "actor-a",
    1,
    2,
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let started = false;
  await assert.rejects(
    capacity.run("actor-b", 1, 2, () => {
      started = true;
      return Promise.resolve();
    }),
    /busy/,
  );
  assert.equal(started, false);
  finish();
  await held;
});
