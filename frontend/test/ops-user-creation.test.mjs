import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/operations/user-creation/user-creation-model.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { opsCreationOptions } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const KNOWN = ["PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER", "CLIENT_ADMIN"];
const policy = {
  enabled: true,
  roles: ["CLIENT_ADMIN", "VERIFIER", "FUTURE_ROLE"],
  branches: [
    { id: "b-1", name: "Pune", city: "Pune West" },
    { id: "b-2", name: "Delhi", city: null },
  ],
  tenantWideAllowed: false,
};

test("the Ops entry does not exist while the admin toggle is OFF or unknown", () => {
  assert.equal(opsCreationOptions(undefined, KNOWN), null);
  assert.equal(opsCreationOptions({ ...policy, enabled: false }, KNOWN), null);
  assert.equal(opsCreationOptions({ ...policy, roles: ["FUTURE_ROLE"] }, KNOWN), null);
});

test("the reused dialog only offers roles the server delegated, in the UI role order", () => {
  assert.deepEqual(opsCreationOptions(policy, KNOWN)?.roles, ["VERIFIER", "CLIENT_ADMIN"]);
});

test("branch options and the all-branches choice come from the server scope", () => {
  const options = opsCreationOptions(policy, KNOWN);
  assert.deepEqual(options?.branches, [
    { id: "b-1", label: "Pune · Pune West" },
    { id: "b-2", label: "Delhi" },
  ]);
  assert.equal(options?.allowTenantWide, false);
  assert.equal(
    opsCreationOptions({ ...policy, tenantWideAllowed: true }, KNOWN)?.allowTenantWide,
    true,
  );
});
