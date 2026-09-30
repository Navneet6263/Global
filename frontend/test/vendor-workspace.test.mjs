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

const logs = await load("../src/features/vendor/activity/vendor-log-model.ts");
const report = await load("../src/features/vendor/vendor-report-model.ts");
const requests = await load("../src/features/vendor/vendor-request-model.ts");

test("an upload is logged as uploaded; only a SPOC-RM download reads as received by SPOC-RM", () => {
  const uploaded = logs.vendorLogLabel({
    action: "vendor_assignment.report-uploaded",
    byVendorTeam: true,
  });
  assert.equal(uploaded.label, "Report uploaded");
  assert.equal(
    logs.vendorLogLabel({ action: "vendor_assignment.report-downloaded", byVendorTeam: false })
      .label,
    "Report downloaded by SPOC-RM",
  );
  assert.equal(
    logs.vendorLogLabel({ action: "vendor_assignment.report-downloaded", byVendorTeam: true })
      .label,
    "Report downloaded",
  );
});

test("every vendor action has a readable label, and unknown ones still read cleanly", () => {
  const expected = {
    "vendor_assignment.assigned": "Request received",
    "vendor_assignment.reassigned": "Request received again",
    "vendor_assignment.reminded": "Reminder sent",
    "vendor_assignment.approved": "Approved",
    "vendor_assignment.rejected": "Rejected",
    "document.previewed": "Document previewed",
    "document.reupload-requested": "Sent back to the candidate for re-upload",
    "user.created": "Team user created",
    "user.password.reset": "Team user password reset",
  };
  for (const [action, label] of Object.entries(expected))
    assert.equal(logs.vendorLogLabel({ action, byVendorTeam: true }).label, label, action);
  assert.equal(
    logs.vendorLogLabel({ action: "vendor_assignment.rejected", byVendorTeam: true }).tone,
    "rose",
  );
  const unknown = logs.vendorLogLabel({
    action: "vendor_assignment.some-new-thing",
    byVendorTeam: true,
  });
  assert.deepEqual(unknown, { label: "Some new thing", tone: "neutral" });
});

test("the report pre-check mirrors the server: PDF or PNG, not empty, at most 2 MB", () => {
  const max = 2 * 1024 * 1024;
  assert.equal(report.REPORT_MAX_BYTES, max);
  assert.equal(report.reportFileProblem({ type: "application/pdf", size: max }), null);
  assert.equal(report.reportFileProblem({ type: "image/png", size: 10 }), null);
  assert.match(report.reportFileProblem({ type: "image/jpeg", size: 10 }), /PDF or PNG/);
  assert.match(report.reportFileProblem({ type: "application/pdf", size: max + 1 }), /2 MB/);
  assert.match(report.reportFileProblem({ type: "application/pdf", size: 0 }), /empty/);
  assert.equal(report.reportDownloadName("SG 1/2", 3, "image/png"), "vendor-report-SG_1_2-v3.png");
});

test("each overview card opens its sidebar view and flags waiting work", () => {
  const cards = requests.vendorKpiCards({ pending: 2, approved: 5, rejected: 1 });
  assert.deepEqual(
    cards.map((card) => [card.label, card.value, card.to]),
    [
      ["Pending", 2, "/vendor/pending"],
      ["Approved", 5, "/vendor/approved"],
      ["Rejected", 1, "/vendor/rejected"],
      ["All requests", 8, "/vendor/all"],
    ],
  );
  assert.equal(cards[0].tone, "amber");
  assert.equal(cards[2].tone, "rose");
  const empty = requests.vendorKpiCards({ pending: 0, approved: 0, rejected: 0 });
  assert.equal(empty[0].tone, "mint");
  assert.ok(requests.vendorKpiCards(undefined).every((card) => card.value === "—"));
});
