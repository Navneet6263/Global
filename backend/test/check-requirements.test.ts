import assert from "node:assert/strict";
import test from "node:test";
import {
  caseDocumentRequirements,
  checkRequirements,
  requiredDocumentsForChecks,
} from "../src/cases/check-requirements";

void test("a case asks only for documents its selected checks use", () => {
  const all = JSON.stringify([
    "AADHAAR",
    "EMPLOYMENT_PROOF",
    "EDUCATION_CERTIFICATE",
    "OTHER",
  ]);
  assert.deepEqual(
    JSON.parse(requiredDocumentsForChecks(all, ["EDUCATION"])),
    ["EDUCATION_CERTIFICATE", "OTHER"],
  );
});

void test("an unreadable document list is left for the existing policy error", () => {
  assert.equal(requiredDocumentsForChecks("not json", ["EDUCATION"]), "not json");
});

void test("check-wise requirements list documents and required details", () => {
  const [employment, criminal] = checkRequirements(["EMPLOYMENT", "CRIMINAL"]);
  assert.deepEqual(employment?.documents, ["EMPLOYMENT_PROOF"]);
  assert.ok(employment?.details.includes("Employer name"));
  assert.deepEqual(criminal?.documents, []);
});

void test("the client's list says which check each document is for", () => {
  assert.deepEqual(caseDocumentRequirements(["OTHER"], ["ADDRESS"]), [
    { type: "OTHER", checks: [] },
    { type: "ADDRESS_PROOF", checks: ["ADDRESS"] },
  ]);
});
