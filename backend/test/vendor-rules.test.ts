import assert from "node:assert/strict";
import { test } from "node:test";
import { BadRequestException } from "@nestjs/common";
import {
  decisionFields,
  documentVendorStatus,
  nextVendorAction,
} from "../src/vendor-requests/services/vendor-rules";

void test("a rejection needs a real reason; an approval does not", () => {
  for (const reason of [undefined, "", "     ", "abc"])
    assert.throws(
      () => decisionFields("REJECTED", reason),
      BadRequestException,
    );
  assert.deepEqual(decisionFields("REJECTED", "  Seal is unreadable  "), {
    status: "REJECTED",
    decisionReason: "Seal is unreadable",
  });
  assert.deepEqual(decisionFields("APPROVED", undefined), {
    status: "APPROVED",
    decisionReason: null,
  });
});

void test("assign starts a chain, only a rejected latest attempt re-opens it, approval closes it", () => {
  const next = (
    rows: Array<{ attempt: number; status: string }>,
    caseStatus = "IN_PROGRESS",
    clean = true,
  ) => nextVendorAction(rows, caseStatus, clean);
  const none = {
    canAssign: false,
    canReassign: false,
    canRequestReupload: false,
  };
  assert.deepEqual(next([]), {
    canAssign: true,
    canReassign: false,
    canRequestReupload: false,
  });
  assert.deepEqual(next([{ attempt: 1, status: "PENDING" }]), none);
  assert.deepEqual(next([{ attempt: 1, status: "REJECTED" }]), {
    canAssign: false,
    canReassign: true,
    canRequestReupload: true,
  });
  assert.deepEqual(
    next([
      { attempt: 2, status: "PENDING" },
      { attempt: 1, status: "REJECTED" },
    ]),
    none,
  );
  assert.deepEqual(next([{ attempt: 1, status: "APPROVED" }]), none);
  assert.deepEqual(next([], "CANCELLED"), none);
  assert.deepEqual(next([{ attempt: 1, status: "REJECTED" }], "CLOSED"), none);
  assert.deepEqual(next([], "IN_PROGRESS", false), none);
  assert.equal(
    documentVendorStatus([
      { attempt: 1, status: "REJECTED" },
      { attempt: 2, status: "APPROVED" },
    ]),
    "APPROVED",
  );
});
