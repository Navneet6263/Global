import assert from "node:assert/strict";
import { test } from "node:test";
import { caseTransitions } from "../src/cases/case.constants";

void test("terminal case states cannot transition", () => {
  assert.deepEqual(caseTransitions.CLOSED, []);
  assert.deepEqual(caseTransitions.CANCELLED, []);
});

void test("QA cannot be bypassed on the normal completion path", () => {
  assert.equal(caseTransitions.IN_PROGRESS.includes("COMPLETED"), false);
  assert.equal(caseTransitions.QA_REVIEW.includes("COMPLETED"), true);
});
