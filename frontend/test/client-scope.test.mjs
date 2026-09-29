import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/users/client-scope.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const scope = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const options = [
  { id: "a-1", label: "Client A" },
  { id: "b-2", label: "Client B" },
  { id: "c-3", label: "Acme Corp" },
];

test("the users table shows SPOC-RM clients, never a misleading branch", () => {
  assert.equal(scope.summarizeClientScope([]), "No clients");
  assert.equal(scope.summarizeClientScope(["Client A"]), "Client A");
  assert.equal(scope.summarizeClientScope(["Client A", "Client B"]), "Client A, Client B");
  assert.equal(
    scope.summarizeClientScope(["Client A", "Client B", "Client C"]),
    "Client A, Client B +1",
  );
});

test("ticking and unticking clients keeps the selection unique", () => {
  assert.deepEqual(scope.toggleClient([], "a-1"), ["a-1"]);
  assert.deepEqual(scope.toggleClient(["a-1", "b-2"], "A-1"), ["b-2"]);
  assert.deepEqual(scope.selectAllClients(["b-2"], options), ["b-2", "a-1", "c-3"]);
  assert.deepEqual(
    scope.filterClientOptions(options, "  client ").map((option) => option.id),
    ["a-1", "b-2"],
  );
});

test("edit role access only saves when the client set really changed", () => {
  assert.equal(scope.sameClientSet(["a-1", "b-2"], ["B-2", "a-1"]), true);
  assert.equal(scope.sameClientSet(["a-1", "b-2"], ["a-1"]), false);
  assert.equal(scope.sameClientSet(["a-1"], ["c-3"]), false);
});
