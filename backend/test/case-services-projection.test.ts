import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import {
  presentCaseDetail,
  presentCaseListItem,
} from "../src/cases/case.presenter";

const actor = (role: string) =>
  ({ roles: [role], userPublicId: "assigned-user" }) as Actor;
const row = {
  publicId: "case-1",
  subject: { publicId: "subject-1", fullName: "Candidate" },
  checks: [
    {
      publicId: "own-check",
      type: "IDENTITY",
      tasks: [{ assignee: { publicId: "assigned-user" } }],
    },
    {
      publicId: "other-check",
      type: "EDUCATION",
      tasks: [{ assignee: { publicId: "another-user" } }],
    },
  ],
  services: [
    {
      publicId: "service-1",
      name: "Combined package",
      requiredDocumentsJson: '["AADHAAR","DEGREE"]',
      checks: [
        { publicId: "own-check", type: "IDENTITY" },
        { publicId: "other-check", type: "EDUCATION" },
      ],
    },
  ],
};

void test("list and detail service checks follow verifier assignment scope", () => {
  for (const present of [presentCaseListItem, presentCaseDetail]) {
    const result = present(row, actor("VERIFIER"));
    assert.equal(result.services.length, 1);
    assert.deepEqual(result.services[0]?.checks, [
      { publicId: "own-check", type: "IDENTITY" },
    ]);
    assert.deepEqual(result.services[0]?.requiredDocuments, [
      "AADHAAR",
      "DEGREE",
    ]);
    assert.equal(JSON.stringify(result).includes("other-check"), false);
  }
});

void test("field service summaries never expose service check work", () => {
  for (const present of [presentCaseListItem, presentCaseDetail]) {
    const result = present(row, actor("FIELD_EXECUTIVE"));
    assert.equal(result.services.length, 1);
    assert.deepEqual(result.services[0]?.checks, []);
    assert.equal(JSON.stringify(result).includes("own-check"), false);
    assert.equal(JSON.stringify(result).includes("other-check"), false);
  }
});

void test("operations retain the complete selected service checklist", () => {
  const result = presentCaseDetail(row, actor("OPS_MANAGER"));
  assert.deepEqual(result.services[0]?.checks, row.services[0]?.checks);
});
