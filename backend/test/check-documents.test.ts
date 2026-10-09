import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import {
  documentScope,
  hasCheckDocumentScope,
  verifierDocumentTypes,
  visibleDocumentTypes,
} from "../src/verification/check-documents";

const verifier = {
  tenantId: 1n,
  userId: 21n,
  roles: ["VERIFIER"],
  departments: [],
} as unknown as Actor;
const lead = {
  ...verifier,
  userId: 30n,
  departments: [{ id: 4n, role: "LEAD", kind: "VERIFICATION" }],
} as unknown as Actor;

void test("a verifier sees its check's documents plus Aadhaar and PAN", () => {
  assert.deepEqual(verifierDocumentTypes("EMPLOYMENT"), [
    "EMPLOYMENT_PROOF",
    "AADHAAR",
    "PAN",
  ]);
  assert.deepEqual(verifierDocumentTypes("ADDRESS"), [
    "ADDRESS_PROOF",
    "AADHAAR",
    "PAN",
  ]);
  const checks = [
    { type: "EMPLOYMENT", departmentId: 4n, tasks: [{ assigneeId: 21n }] },
    { type: "EDUCATION", departmentId: 5n, tasks: [{ assigneeId: 77n }] },
  ];
  assert.deepEqual([...visibleDocumentTypes(verifier, checks)!].sort(), [
    "AADHAAR",
    "EMPLOYMENT_PROOF",
    "PAN",
  ]);
  // The Team Leader of department 4 sees that team's check documents.
  assert.deepEqual([...visibleDocumentTypes(lead, checks)!].sort(), [
    "AADHAAR",
    "EMPLOYMENT_PROOF",
    "PAN",
  ]);
});

void test("Operations, QA, Data Entry and the RM keep every document", () => {
  for (const roles of [
    ["OPS_MANAGER"],
    ["QA_REVIEWER"],
    ["DATA_ENTRY"],
    ["SPOC_RM"],
    ["SPOC_RM", "VERIFIER"],
  ]) {
    const actor = { ...verifier, roles };
    assert.equal(hasCheckDocumentScope(actor), false);
    assert.deepEqual(documentScope(actor), {});
    assert.equal(visibleDocumentTypes(actor, []), null);
  }
});

void test("the database filter ties each document type to the verifier's own check", () => {
  const scope = documentScope(verifier) as {
    OR: Array<Record<string, unknown>>;
  };
  const text = JSON.stringify(scope, (_k, v: unknown) =>
    typeof v === "bigint" ? String(v) : v,
  );
  assert.ok(scope.OR.length > 2);
  assert.match(text, /"type":\{"in":\["AADHAAR","PAN"\]\}/);
  assert.match(
    text,
    /"EMPLOYMENT_PROOF"\]\},"case":\{"checks":\{"some":\{"AND":\[\{"type":"EMPLOYMENT"\}/,
  );
  assert.match(text, /"assigneeId":"21"/);
});
