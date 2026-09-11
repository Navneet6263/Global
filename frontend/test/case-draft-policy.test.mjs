import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/cases/new-case/case-draft-policy.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { updateCaseDraft, estimatedServiceHours } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const draft = {
  candidate: "Candidate",
  email: "candidate@example.invalid",
  phone: "7004023078",
  clientId: "client-a",
  client: "Client A",
  priority: "Standard",
  services: [
    { servicePackageId: "package-a", details: { declaration: "Private old declaration" } },
  ],
  servicePackageId: "package-a",
  packageName: "Old package",
  packageTatHours: 120,
  checks: ["IDENTITY"],
};

test("changing client clears every selected service/check/declaration while preserving candidate", () => {
  const next = updateCaseDraft(draft, { clientId: "client-b", client: "Client B" });
  assert.equal(next.clientId, "client-b");
  assert.equal(next.candidate, draft.candidate);
  assert.equal(next.email, draft.email);
  assert.equal(next.priority, draft.priority);
  assert.equal(next.servicePackageId, "");
  assert.equal(next.packageName, "");
  assert.equal(next.packageTatHours, 0);
  assert.deepEqual(next.services, []);
  assert.deepEqual(next.checks, []);
  assert.equal(JSON.stringify(next).includes("Private old declaration"), false);
  assert.equal(draft.services.length, 1);
});

test("fixed client name refresh and candidate edits do not clear existing service work", () => {
  assert.deepEqual(
    updateCaseDraft(draft, { clientId: "client-a", client: "Renamed client" }).services,
    draft.services,
  );
  assert.deepEqual(
    updateCaseDraft(draft, { candidate: "Corrected candidate" }).checks,
    draft.checks,
  );
});

test("review estimate uses current effective catalogue TAT, not stale draft days", () => {
  const packages = [
    { id: "package-a", tatHours: 36 },
    { id: "package-b", tatHours: 72 },
  ];
  assert.equal(estimatedServiceHours(draft, packages), 36);
  assert.equal(estimatedServiceHours({ ...draft, priority: "Critical" }, packages), 24);
  const selected = {
    ...draft,
    services: [{ servicePackageId: "package-a" }, { servicePackageId: "package-b" }],
  };
  assert.equal(estimatedServiceHours(selected, packages), 72);
  assert.equal(estimatedServiceHours({ ...selected, priority: "Priority" }, packages), 48);
  assert.equal(estimatedServiceHours(draft, [{ id: "package-a", tatHours: 12 }]), 12);
});

test("missing package or invalid TAT never yields a fabricated turnaround commitment", () => {
  assert.equal(estimatedServiceHours(draft, []), null);
  assert.equal(estimatedServiceHours(draft, [{ id: "package-a", tatHours: 0 }]), null);
});
