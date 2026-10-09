import assert from "node:assert/strict";
import { test } from "node:test";
import {
  presentCaseDetail,
  presentCaseListItem,
} from "../src/cases/case.presenter";
import { testActor } from "./helpers/test-actor";

const row = {
  publicId: "case-1",
  caseNumber: "SG-1",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  subject: { fullName: "Aarav Sharma" },
  client: {
    publicId: "client-1",
    code: "HZN",
    displayName: "Horizon Tech",
    primaryRm: { publicId: "rm-1", displayName: "Riya Mehta" },
  },
  assignedOpsUser: { publicId: "rm-1", displayName: "Riya Mehta" },
  workflowVersion: 2,
  checks: [],
  fieldVisits: [],
};

void test("the company RM is internal: Operations sees it, the client admin never does", () => {
  const ops = presentCaseListItem(
    row,
    testActor(["OPS_MANAGER"], ["case:read"]),
  ) as {
    client: Record<string, unknown>;
    workflow: { companyRm: unknown };
  };
  assert.deepEqual(ops.workflow.companyRm, {
    publicId: "rm-1",
    displayName: "Riya Mehta",
  });
  assert.equal(ops.client.primaryRm, undefined);

  const client = presentCaseListItem(row, {
    ...testActor(["CLIENT_ADMIN"], ["case:read"]),
    clientId: 1n,
  }) as { client: Record<string, unknown>; workflow?: unknown };
  assert.deepEqual(client.client, {
    publicId: "client-1",
    code: "HZN",
    displayName: "Horizon Tech",
  });
  assert.equal(client.workflow, undefined);
  assert.ok(!JSON.stringify(client).includes("Riya Mehta"));
});

void test("a person with several roles keeps the workflow stage of RM / Data Entry", () => {
  const intake = { ...row, intakeStage: "DATA_ENTRY" };
  for (const roles of [
    ["QA_REVIEWER", "SPOC_RM", "DATA_ENTRY"],
    ["QA_REVIEWER", "SPOC_RM"],
    ["VERIFIER", "DATA_ENTRY"],
  ]) {
    const view = presentCaseDetail(intake, testActor(roles, ["case:read"])) as {
      workflow?: { intakeStage?: string };
    };
    assert.equal(view.workflow?.intakeStage, "DATA_ENTRY", roles.join("+"));
  }
  // A QA reviewer alone still gets the narrower QA view.
  const qa = presentCaseDetail(
    intake,
    testActor(["QA_REVIEWER"], ["case:read"]),
  ) as {
    workflow?: unknown;
  };
  assert.equal(qa.workflow, undefined);
});
