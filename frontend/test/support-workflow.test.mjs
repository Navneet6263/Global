import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

const support = await load("../src/features/support/support-model.ts");
const spoc = await load("../src/features/spoc-rm/vendors/spoc-vendor-model.ts");
const candidate = await load("../src/components/candidate/candidate-utils.ts");

test("support labels every employee state and request status", () => {
  for (const state of ["PENDING", "EXCEPTION", "COMPLETED", "CANCELLED"])
    assert.ok(support.CASE_STATE_META[state].label, state);
  assert.equal(support.CASE_STATE_META.EXCEPTION.tone, "critical");
  assert.equal(support.REQUEST_STATUS_META.OPEN.label, "Open");
  assert.equal(support.REQUEST_STATUS_META.RESOLVED.tone, "success");
  assert.equal(support.REQUESTER_LABEL.CLIENT_ADMIN, "Client Admin");
});

test("an agent can start only open requests and resolve anything unresolved", () => {
  assert.deepEqual(support.requestActions("OPEN"), { canStart: true, canResolve: true });
  assert.deepEqual(support.requestActions("IN_PROGRESS"), { canStart: false, canResolve: true });
  assert.deepEqual(support.requestActions("RESOLVED"), { canStart: false, canResolve: false });
});

test("support text mirrors the server rule and documents summarise at a glance", () => {
  assert.equal(support.isValidSupportText("   ab  ", 160), false);
  assert.equal(support.isValidSupportText("  Upload fails  ", 160), true);
  assert.equal(support.isValidSupportText("x".repeat(161), 160), false);
  assert.equal(
    support.documentSummary({ uploaded: 0, verified: 0, awaitingReview: 0, needsCorrection: 0 }),
    "Nothing uploaded yet",
  );
  assert.equal(
    support.documentSummary({ uploaded: 3, verified: 2, awaitingReview: 0, needsCorrection: 1 }),
    "3 uploaded · 2 verified · 1 to re-upload",
  );
});

test("the vendor timeline places re-upload requests and new versions in time order", () => {
  const rejected = {
    id: "a1",
    attempt: 1,
    status: "REJECTED",
    version: 2,
    documentVersion: 1,
    vendor: { id: "v1", name: "Acme Vendors" },
    assignedBy: "Sam SPOC",
    assignedAt: "2026-09-28T10:00:00Z",
    note: null,
    resolutionNote: null,
    decidedBy: "Acme Vendors",
    decidedAt: "2026-09-28T11:00:00Z",
    reason: "ytrtutyu",
  };
  const reassigned = {
    ...rejected,
    id: "a2",
    attempt: 2,
    status: "PENDING",
    documentVersion: 2,
    vendor: { id: "v2", name: "Beta Checks" },
    assignedAt: "2026-09-29T12:00:00Z",
    resolutionNote: "Candidate uploaded a clear copy",
    decidedBy: null,
    decidedAt: null,
    reason: null,
  };
  const steps = spoc.timelineSteps(
    [rejected, reassigned],
    [
      {
        requestedAt: "2026-09-28T12:00:00Z",
        requestedBy: "Sam SPOC",
        message: "Upload again",
        documentVersion: 1,
        attempt: 1,
      },
    ],
    [
      { version: 1, uploadedAt: "2026-09-27T09:00:00Z", uploadedBy: "Candidate" },
      { version: 2, uploadedAt: "2026-09-29T09:00:00Z", uploadedBy: "Candidate" },
    ],
  );
  assert.deepEqual(
    steps.map((step) => step.kind),
    ["assigned", "rejected", "reupload", "upload", "resolution", "reassigned", "pending"],
  );
  assert.equal(steps[2].detail, "Upload again");
  assert.equal(steps[3].title, "Version v2 uploaded");
  assert.equal(spoc.REUPLOAD_META.REQUESTED.label, "Re-upload requested");
  assert.equal(spoc.REUPLOAD_META.RECEIVED.label, "New version ready");
});

test("the candidate page lists exactly the documents that need uploading again", () => {
  const documents = [
    { type: "PAN", status: "VERIFIED" },
    { type: "EDUCATION_CERTIFICATE", status: "REUPLOAD_REQUIRED" },
    { type: "ADDRESS_PROOF", status: "REJECTED" },
    { type: "AADHAAR", status: "AVAILABLE" },
  ];
  assert.deepEqual(
    candidate.documentsToReupload(documents).map((document) => document.type),
    ["EDUCATION_CERTIFICATE", "ADDRESS_PROOF"],
  );
});
