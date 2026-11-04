import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/permissions/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { can, isVisible } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

const viewOnlyAdmin = { roles: ["PLATFORM_ADMIN"], permissions: ["*"], viewOnly: true };

test("a view-only Platform Admin sees Platform Settings and keeps user ID work", () => {
  assert.equal(
    isVisible(viewOnlyAdmin, { permission: "settings:manage", roles: ["PLATFORM_ADMIN"] }),
    true,
  );
  assert.equal(can(viewOnlyAdmin, "user:write"), true);
  assert.equal(can(viewOnlyAdmin, "case:read"), true);
});

test("a view-only Platform Admin still gets no case or finance writes", () => {
  for (const permission of ["case:create", "case:transition", "task:write", "finance:write"]) {
    assert.equal(can(viewOnlyAdmin, permission), false, permission);
  }
});

test("without the permission, admin work stays hidden", () => {
  const ops = { roles: ["OPS_MANAGER"], permissions: ["user:read"], viewOnly: false };
  assert.equal(can(ops, "settings:manage"), false);
});
