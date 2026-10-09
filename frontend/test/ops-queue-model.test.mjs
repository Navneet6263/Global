import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadPure(path) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const model = await loadPure("../src/features/operations/workspace/ops-queue-model.ts");
const backend = await loadPure("../../backend/src/cases/case.constants.ts");

test("URL filters accept only known views, stages and safe identifiers", () => {
  assert.deepEqual(
    model.parseOpsQueueSearch({
      view: "needs-rm",
      stage: "qa",
      clientId: "client-1",
      ownerId: "rm-1",
      page: "3",
      pageSize: "12",
      q: "  Kabir ",
    }),
    {
      caseId: undefined,
      q: "Kabir",
      view: "needs-rm",
      stage: "qa",
      clientId: "client-1",
      ownerId: "rm-1",
      page: 3,
      pageSize: 12,
    },
  );
  const unsafe = model.parseOpsQueueSearch({
    view: "approve",
    stage: "anything",
    clientId: "a b",
    ownerId: "x".repeat(65),
    page: 0,
    pageSize: 500,
  });
  assert.deepEqual(unsafe, {
    caseId: undefined,
    q: undefined,
    view: undefined,
    stage: undefined,
    clientId: undefined,
    ownerId: undefined,
    page: undefined,
    pageSize: undefined,
  });
});

test("queue shortcuts translate to server filters on the active case view", () => {
  const needsRm = model.opsQueueQuery({ view: "needs-rm", ownerId: "rm-1" });
  assert.equal(needsRm.view, "active");
  assert.equal(needsRm.unassigned, true);
  assert.equal(needsRm.ownerId, undefined);
  assert.equal(model.opsQueueQuery({ view: "overdue" }).sla, "overdue");
  assert.equal(model.opsQueueQuery({ view: "documents" }).status, "DOCUMENT_PENDING");
  assert.equal(model.opsQueueQuery({ view: "queries" }).status, "CLARIFICATION_PENDING");
  assert.equal(model.opsQueueQuery({ view: "qc", stage: "documents" }).stage, undefined);
  assert.equal(model.opsQueueQuery({ view: "completed" }).stage, "completed");
  const plain = model.opsQueueQuery({ page: 2 });
  assert.deepEqual(
    { page: plain.page, pageSize: plain.pageSize, sortBy: plain.sortBy, sortDir: plain.sortDir },
    { page: 2, pageSize: 6, sortBy: "sla", sortDir: "asc" },
  );
  assert.equal("tenantId" in plain, false);
});

test("every backend status has an operations stage and pipeline step", () => {
  for (const status of backend.CaseStatuses) {
    const stage = model.opsStage(status);
    assert.ok(stage.label && stage.next, status);
    assert.ok(stage.step >= 0 && stage.step <= model.pipelineSteps.length, status);
  }
  assert.equal(model.opsStage("MANAGER_REVIEW").label, "RM approval");
});

test("working with uses only assignee names returned by the API", () => {
  const base = { assignedOpsUser: { publicId: "rm", displayName: "Riya Mehta" } };
  const task = (name, status = "IN_PROGRESS") => ({
    status,
    assignee: name ? { displayName: name } : null,
  });
  assert.deepEqual(
    model.workingWith({
      ...base,
      status: "IN_PROGRESS",
      checks: [{ tasks: [task("Neeraj"), task("Old", "COMPLETED")] }],
    }),
    { name: "Neeraj", role: "Verifier" },
  );
  assert.equal(
    model.workingWith({ ...base, status: "IN_PROGRESS", checks: [{ tasks: [task(null)] }] }).name,
    "Unassigned checks",
  );
  assert.deepEqual(model.workingWith({ ...base, status: "MANAGER_REVIEW", checks: [] }), {
    name: "Riya Mehta",
    role: "RM",
  });
  assert.equal(model.workingWith({ status: "DOCUMENT_PENDING", checks: [] }).name, "Candidate");
});

test("pending reasons come from recorded documents, requests, owner and due date", () => {
  const now = Date.parse("2026-10-06T10:00:00Z");
  const reasons = model.pendingReasons(
    {
      status: "CLARIFICATION_PENDING",
      dueAt: "2026-10-06T07:30:00Z",
      assignedOpsUser: null,
      checks: [],
      documents: [
        { type: "ADDRESS_PROOF", status: "REJECTED", reviewNote: "Image unreadable" },
        { type: "ID_PROOF", status: "ACCEPTED" },
      ],
      clarifications: [
        { status: "OPEN", subject: "Confirm joining date" },
        { status: "RESOLVED", subject: "Old" },
      ],
    },
    now,
  );
  assert.deepEqual(
    reasons.map((reason) => reason.title),
    [
      "No responsible RM assigned",
      "Address proof needs replacement",
      "Information requested",
      "Overdue 2h beyond the due time",
    ],
  );
  assert.equal(reasons[1].detail, "Image unreadable");
});

test("pending since uses the latest entry into the current status", () => {
  assert.equal(
    model.pendingSince({
      status: "DOCUMENT_PENDING",
      createdAt: "2026-10-01T00:00:00Z",
      statusHistory: [
        { toStatus: "DOCUMENT_PENDING", createdAt: "2026-10-02T00:00:00Z" },
        { toStatus: "IN_PROGRESS", createdAt: "2026-10-03T00:00:00Z" },
        { toStatus: "DOCUMENT_PENDING", createdAt: "2026-10-04T00:00:00Z" },
      ],
    }),
    "2026-10-04T00:00:00Z",
  );
  assert.equal(model.istDateTime("2026-10-04T00:00:00Z").endsWith(" IST"), true);
});

test("only active RMs mapped to the case client are eligible", () => {
  const users = [
    { id: "a", status: "ACTIVE", roles: [{ code: "SPOC_RM" }], spocClients: [{ id: "c1" }] },
    { id: "b", status: "SUSPENDED", roles: [{ code: "SPOC_RM" }], spocClients: [{ id: "c1" }] },
    { id: "c", status: "ACTIVE", roles: [{ code: "SPOC_RM" }], spocClients: [{ id: "c2" }] },
    { id: "d", status: "ACTIVE", roles: [{ code: "VERIFIER" }], spocClients: [{ id: "c1" }] },
  ];
  assert.deepEqual(
    model.eligibleRms(users, "c1").map((user) => user.id),
    ["a"],
  );
});
