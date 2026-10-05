import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const url = (source) =>
  "data:text/javascript;base64," + Buffer.from(compile(source)).toString("base64");
const base = "../src/features/stakeholders/client/";
const utils = url(
  await readFile(new URL(base + "client-portal-utils.ts", import.meta.url), "utf8"),
);
const source = (
  await readFile(new URL(base + "client-case-activity.ts", import.meta.url), "utf8")
).replace('"./client-portal-utils"', JSON.stringify(utils));
const { clientCaseActivity, caseDate, clientNextStep } = await import(url(source));
const fixture = () => ({
  caseNumber: "SG-TEST",
  createdAt: "2026-10-01T00:00:00Z",
  statusHistory: [
    {
      fromStatus: "DOCUMENT_PENDING",
      toStatus: "IN_PROGRESS",
      createdAt: "2026-10-01T01:00:00Z",
      reason: "INTERNAL SECRET",
    },
  ],
  consents: [],
  documents: [],
  checks: [],
  clarifications: [],
  reports: [],
});

test("activity orders actual events newest first without exposing internal reasons", () => {
  const item = fixture();
  item.checks.push({
    publicId: "check",
    type: "EDUCATION",
    completedAt: "2026-10-01T02:00:00Z",
    result: "CLEAR",
    sourceSummary: "INTERNAL SECRET",
  });
  item.documents.push({
    publicId: "doc",
    type: "IDENTITY",
    currentVersion: 1,
    status: "APPROVED",
    reviewedAt: "2026-10-01T03:00:00Z",
    reviewNote: "INTERNAL SECRET",
    versions: [],
  });
  const events = clientCaseActivity(item);
  assert.deepEqual(
    events.map((event) => event.kind),
    ["Documents", "Checks", "Case", "Case"],
  );
  assert.ok(!JSON.stringify(events).includes("INTERNAL SECRET"));
  assert.equal(events.filter((event) => event.title.includes("uploaded")).length, 0);
});

test("missing and invalid timestamps never become invented activity", () => {
  const item = fixture();
  item.createdAt = "bad date";
  item.statusHistory = [];
  item.checks = [{ publicId: "a", type: "IDENTITY", status: "COMPLETED" }];
  assert.deepEqual(clientCaseActivity(item), []);
  assert.equal(caseDate(null), "Not recorded");
  assert.equal(caseDate("bad date"), "Not recorded");
  assert.match(caseDate("2026-10-01T00:00:00Z"), /5:30.*IST/);
});

test("consent, clarification and publication use their own timestamps", () => {
  const item = fixture();
  item.consents = [
    { publicId: "consent", createdAt: "2026-10-01T00:10:00Z", acceptedAt: "2026-10-01T00:20:00Z" },
  ];
  item.clarifications = [
    {
      publicId: "request",
      subject: "Degree details",
      createdAt: "2026-10-01T02:00:00Z",
      resolvedAt: "2026-10-01T03:00:00Z",
    },
  ];
  item.reports = [{ publicId: "report", currentVersion: 2, publishedAt: "2026-10-01T04:00:00Z" }];
  const events = clientCaseActivity(item);
  assert.equal(events[0].title, "Report published");
  assert.equal(events.filter((event) => event.kind === "Consent").length, 2);
  assert.equal(events.filter((event) => event.kind === "Requests").length, 2);
});

test("next steps distinguish cancellation, quality review and report release", () => {
  assert.match(clientNextStep("CANCELLED").text, /does not mean verification passed/);
  assert.deepEqual(clientNextStep("QA_PENDING"), clientNextStep("QA_REVIEW"));
  assert.equal(clientNextStep("DOCUMENT_PENDING").target, "documents");
  assert.equal(clientNextStep("CLARIFICATION_PENDING").target, "requests");
  assert.match(clientNextStep("QA_REVIEW").text, /not final report release/);
});
