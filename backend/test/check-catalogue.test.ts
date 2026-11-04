import assert from "node:assert/strict";
import { test } from "node:test";
import { CheckTypes } from "../src/cases/case.constants";
import {
  CHECK_CATALOGUE,
  cleanCheckOptions,
  documentPlan,
  packageRequiredDocuments,
} from "../src/packages/check-catalogue";
import { RequiredDocumentTypes } from "../src/cases/case-service-plan";

void test("every check type is in the catalogue, once, and every document is uploadable", () => {
  assert.deepEqual(
    [...CHECK_CATALOGUE.map((entry) => entry.type)].sort(),
    [...CheckTypes].sort(),
  );
  for (const entry of CHECK_CATALOGUE) {
    if (entry.document)
      assert.ok(
        (RequiredDocumentTypes as readonly string[]).includes(entry.document),
        entry.type,
      );
  }
});

void test("reference prices and TAT follow the a la carte sheet", () => {
  const find = (type: string) => CHECK_CATALOGUE.find((e) => e.type === type)!;
  assert.deepEqual([find("EDUCATION").price, find("EDUCATION").tatDays], [350, 14]);
  assert.deepEqual([find("EMPLOYMENT").price, find("EMPLOYMENT").tatDays], [250, 12]);
  assert.deepEqual([find("BANK_ACCOUNT").price, find("BANK_ACCOUNT").tatDays], [275, 5]);
  assert.deepEqual(
    find("DRUG_TEST").option?.choices?.map((choice) => choice.price),
    [850, 950, 1050, 1250],
  );
});

void test("4 checks can mean 7 papers, and the plan says which and why", () => {
  const checks = ["IDENTITY", "ADDRESS", "EDUCATION", "EMPLOYMENT"];
  const options = cleanCheckOptions(
    {
      IDENTITY: { ids: ["AADHAAR", "PAN"] },
      ADDRESS: { addresses: ["CURRENT", "PERMANENT"] },
      EDUCATION: { levels: ["GRADUATION", "POST_GRADUATION"] },
      EMPLOYMENT: { count: 1 },
    },
    checks,
  );
  const plan = documentPlan(checks, options);
  // Aadhaar, PAN, one address file, one education file, one employment letter.
  assert.equal(plan.totalUploads, 5);
  assert.equal(plan.totalPapers, 7);
  const education = plan.uploads.find((row) => row.type === "EDUCATION_CERTIFICATE")!;
  assert.deepEqual(education.papers, ["Graduation", "Post graduation / MBA"]);
  assert.deepEqual(education.forChecks, ["Education credential check"]);
  assert.match(education.why[0]!, /each qualification/);
  const address = plan.uploads.find((row) => row.type === "ADDRESS_PROOF")!;
  assert.deepEqual(address.papers, ["Current address", "Permanent address"]);
});

void test("a document two checks share is asked for once; no-document checks say why", () => {
  const checks = ["IDENTITY", "CREDIT_CHECK", "COURT_RECORD", "REFERENCE"];
  const plan = documentPlan(
    checks,
    cleanCheckOptions({ IDENTITY: { ids: ["PAN"] } }, checks),
  );
  assert.deepEqual(
    plan.uploads.map((row) => [row.type, row.forChecks]),
    [["PAN", ["National ID check", "Credit check (CIBIL)"]]],
  );
  assert.deepEqual(
    plan.noDocument.map((row) => row.type),
    ["COURT_RECORD", "REFERENCE"],
  );
  assert.ok(plan.noDocument.every((row) => row.why.length > 0));
});

void test("bad or missing options fall back to the check's default", () => {
  const checks = ["IDENTITY", "EDUCATION", "EMPLOYMENT", "DRUG_TEST", "GLOBAL_DATABASE"];
  assert.deepEqual(
    cleanCheckOptions(
      {
        IDENTITY: { ids: ["VOTER_ID"] },
        EMPLOYMENT: { count: 9 },
        DRUG_TEST: { panel: "10" },
        GLOBAL_DATABASE: { count: 2 },
        NOT_IN_PACKAGE: { count: 2 },
      },
      checks,
    ),
    {
      IDENTITY: { ids: ["AADHAAR"] },
      EDUCATION: { levels: ["HIGHEST"] },
      EMPLOYMENT: { count: 1 },
      DRUG_TEST: { panel: "10" },
    },
  );
});

void test("a package asks for its checks' documents plus any extra Operations adds", () => {
  const checks = ["IDENTITY", "BANK_ACCOUNT", "GLOBAL_DATABASE"];
  assert.deepEqual(
    packageRequiredDocuments(checks, cleanCheckOptions({}, checks), ["OTHER"]),
    ["AADHAAR", "BANK_PROOF", "OTHER"],
  );
});
