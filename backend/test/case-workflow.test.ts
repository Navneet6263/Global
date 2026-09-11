import assert from "node:assert/strict";
import { test } from "node:test";
import { caseTransitions } from "../src/cases/case.constants";

void test("terminal case states cannot transition", () => {
  assert.deepEqual(caseTransitions.CLOSED, []);
  assert.deepEqual(caseTransitions.CANCELLED, []);
});

void test("QA, manager review, report preparation and payment cannot be bypassed", () => {
  assert.equal(
    (caseTransitions.IN_PROGRESS ?? []).includes("COMPLETED"),
    false,
  );
  assert.deepEqual(caseTransitions.QA_REVIEW, [
    "IN_PROGRESS",
    "MANAGER_REVIEW",
  ]);
  assert.deepEqual(caseTransitions.MANAGER_REVIEW, [
    "IN_PROGRESS",
    "REPORT_PENDING",
  ]);
  assert.deepEqual(caseTransitions.REPORT_PENDING, ["PAYMENT_PENDING"]);
  assert.deepEqual(caseTransitions.PAYMENT_PENDING, ["COMPLETED"]);
});
