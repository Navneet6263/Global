import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/cases/new-case/service-selection.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { serviceSelectionError } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const packages = [
  { id: "vendor", name: "Vendor scope", serviceFamily: "VENDORCHECK" },
  { id: "hire", name: "Employee scope", serviceFamily: "HIRECHECK" },
];

test("VendorCheck intake cannot continue without the business identity", () => {
  const draft = {
    checks: ["COMPANY_REGISTRATION"],
    servicePackageId: "vendor",
    services: [{ servicePackageId: "vendor" }],
  };
  assert.match(serviceSelectionError(draft, packages), /registered business name/);
  draft.services[0].details = {
    organisationName: "Test Organisation",
    registrationNumber: "TEST-REG-1",
  };
  assert.equal(serviceSelectionError(draft, packages), undefined);
  draft.services[0].details.gstin = "not-a-gstin";
  assert.match(serviceSelectionError(draft, packages), /GSTIN/);
});

test("multi-service selection rejects duplicates and removed packages", () => {
  const draft = {
    checks: ["IDENTITY"],
    servicePackageId: "hire",
    services: [{ servicePackageId: "hire" }, { servicePackageId: "hire" }],
  };
  assert.match(serviceSelectionError(draft, packages), /different/);
  draft.services = [{ servicePackageId: "removed" }];
  assert.match(serviceSelectionError(draft, packages), /no longer available/);
  draft.services = [{ servicePackageId: "hire" }];
  assert.equal(serviceSelectionError(draft, packages), undefined);
});
