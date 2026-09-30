import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const team = await load("../src/features/vendor/team/vendor-team-model.ts");

test("a vendor can create team users only while an Admin-set slot is free", () => {
  assert.deepEqual(
    { ...team.teamCapacity({ limit: 2, active: 1 }), hint: undefined },
    { remaining: 1, canCreate: true, label: "1 of 2 active", hint: undefined },
  );
  assert.equal(team.teamCapacity({ limit: 2, active: 2 }).canCreate, false);
  assert.match(team.teamCapacity({ limit: 2, active: 2 }).hint, /Limit reached/);
  assert.equal(team.teamCapacity({ limit: 0, active: 0 }).canCreate, false);
  assert.match(team.teamCapacity({ limit: 0, active: 0 }).hint, /not enabled/);
  assert.equal(team.teamCapacity({ limit: 1, active: 3 }).remaining, 0);
});

test("team rows show status and allow reactivation only when a slot is free", () => {
  assert.equal(team.memberStatus({ status: "ACTIVE", mustChangePassword: true }).label, "Invited");
  assert.equal(team.memberStatus({ status: "ACTIVE", mustChangePassword: false }).label, "Active");
  assert.equal(
    team.memberStatus({ status: "SUSPENDED", mustChangePassword: false }).tone,
    "warning",
  );
  assert.deepEqual(team.memberActions({ status: "ACTIVE" }, { limit: 2, active: 2 }), {
    canSuspend: true,
    canReactivate: false,
    canReset: true,
  });
  assert.equal(
    team.memberActions({ status: "SUSPENDED" }, { limit: 2, active: 1 }).canReactivate,
    true,
  );
  assert.equal(
    team.memberActions({ status: "SUSPENDED" }, { limit: 2, active: 2 }).canReactivate,
    false,
  );
});
