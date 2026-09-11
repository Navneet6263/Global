import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dispatchActor,
  dispatchHarness,
  dispatchInput,
  dispatchRecord,
  uuid,
} from "./fixtures/dispatch.fixture";

function unownedTask() {
  return {
    id: 30n,
    publicId: uuid(30),
    version: 3,
    status: "UNASSIGNED",
    assigneeId: null,
    assignee: null,
  };
}

void test("existing unowned tasks are updated, not duplicated; stale versions fail closed", async () => {
  const record = dispatchRecord();
  record.status = "IN_PROGRESS";
  record.checks[0]!.tasks = [unownedTask()];
  const input = dispatchInput();
  input.allocations[0]!.taskId = uuid(30);
  input.allocations[0]!.version = 3;
  const harness = dispatchHarness(record);
  await harness.service.commit(dispatchActor, uuid(10), input);
  assert.equal(
    harness.state.writes.filter((write) => write.kind === "existing-task")
      .length,
    1,
  );
  assert.equal(
    harness.state.writes.filter((write) => write.kind === "task").length,
    1,
  );
  const changed = dispatchRecord();
  changed.checks[0]!.tasks = [{ ...unownedTask(), version: 4 }];
  const stale = dispatchHarness(changed);
  await assert.rejects(
    stale.service.commit(dispatchActor, uuid(10), input),
    /changed/,
  );
  assert.equal(stale.state.writes.length, 0);
});

void test("new dispatch leaves existing owners untouched and allocates only remaining work", async () => {
  const record = dispatchRecord();
  record.status = "IN_PROGRESS";
  record.checks[0]!.status = "ASSIGNED";
  record.checks[0]!.tasks = [
    {
      ...unownedTask(),
      status: "OPEN",
      assigneeId: 7n,
      assignee: { publicId: uuid(7), displayName: "Existing verifier" },
    },
  ];
  const input = dispatchInput();
  input.allocations = [input.allocations[1]!];
  const harness = dispatchHarness(record);
  const result = await harness.service.commit(dispatchActor, uuid(10), input);
  assert.equal(result.assigned, 1);
  assert.equal(
    harness.state.writes.filter((write) => write.kind === "existing-task")
      .length,
    0,
  );
  assert.equal(harness.state.record?.checks[0]?.tasks[0]?.assigneeId, 7n);
  const forbidden = dispatchHarness(record);
  await assert.rejects(
    forbidden.service.commit(dispatchActor, uuid(10), dispatchInput()),
    /remaining check/,
  );
});
