import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/workflow-ui/team-members-scope.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { visibleTeamsFor } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const TEAMS = [
  { id: "de", name: "Data Entry", memberRole: "DATA_ENTRY" },
  { id: "vendor", name: "Vendor", memberRole: "VERIFIER" },
  { id: "edu", name: "Education", memberRole: "VERIFIER" },
  { id: "emp", name: "Employment", memberRole: "VERIFIER" },
];
const ids = (teams) => teams.map((team) => team.id);

test("working as TL Vendor shows only the Vendor team", () => {
  assert.deepEqual(ids(visibleTeamsFor(TEAMS, "verifier", "vendor")), ["vendor"]);
});

test("verifier page without a chosen team shows verification teams only, never Data Entry", () => {
  assert.deepEqual(ids(visibleTeamsFor(TEAMS, "verifier")), ["vendor", "edu", "emp"]);
});

test("a team the user does not lead is ignored", () => {
  assert.deepEqual(ids(visibleTeamsFor(TEAMS, "verifier", "other")), ["vendor", "edu", "emp"]);
});

test("Data Entry page shows Data Entry teams only, whatever team is chosen", () => {
  assert.deepEqual(ids(visibleTeamsFor(TEAMS, "data-entry", "vendor")), ["de"]);
});
