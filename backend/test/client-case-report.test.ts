import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import {
  clientProgress,
  presentCaseDetail,
  presentCaseListItem,
} from "../src/cases/case.presenter";

const client = {
  tenantId: 1n,
  userId: 9n,
  clientId: 3n,
  roles: ["CLIENT_ADMIN"],
} as unknown as Actor;

const expires = new Date(Date.now() + 86_400_000);

const row = (report: Record<string, unknown>) => ({
  publicId: "case-1",
  caseNumber: "SG-1",
  status: "COMPLETED",
  priority: "NORMAL",
  version: 4,
  createdAt: new Date(),
  updatedAt: new Date(),
  subject: { publicId: "s-1", fullName: "Candidate" },
  client: { publicId: "c-1", code: "C", displayName: "Client" },
  checks: [],
  reports: [
    {
      publicId: "report-1",
      status: "PUBLISHED",
      currentVersion: 1,
      workflowVersion: 2,
      publishedAt: new Date("2026-10-10T09:13:30Z"),
      releasedAt: new Date("2026-10-10T09:13:30Z"),
      downloadExpiresAt: expires,
      ...report,
    },
  ],
});

void test("a completed case carries its released report for the client to download", () => {
  const item = presentCaseListItem(row({}), client) as { report: unknown };
  assert.deepEqual(item.report, {
    id: "report-1",
    version: 1,
    releasedAt: new Date("2026-10-10T09:13:30Z"),
    downloadExpiresAt: expires,
  });
});

void test("no report is offered before release or after download access expires", () => {
  const notReleased = presentCaseListItem(row({ releasedAt: null }), client);
  assert.equal((notReleased as { report: unknown }).report, null);
  const expired = presentCaseListItem(
    row({ downloadExpiresAt: new Date(Date.now() - 1000) }),
    client,
  );
  assert.equal((expired as { report: unknown }).report, null);
});

void test("the client sees the turnaround in working days, never a due date", () => {
  const item = presentCaseListItem(
    {
      ...row({}),
      dueAt: new Date("2026-11-20T04:30:00Z"),
      services: [{ publicId: "svc-1", tatHours: 14 * 24 }],
      checks: [
        {
          publicId: "chk-1",
          type: "EDUCATION",
          dueAt: new Date("2026-11-20T04:30:00Z"),
        },
      ],
    },
    client,
  ) as {
    dueAt: unknown;
    tatWorkingDays: unknown;
    checks: Array<Record<string, unknown>>;
  };
  assert.equal(item.dueAt, null);
  assert.equal(item.tatWorkingDays, 14);
  assert.equal("dueAt" in item.checks[0]!, false);
  assert.equal(JSON.stringify(item).includes("2026-11-20"), false);
});

void test("the client sees where the case waits on documents, in its own words", () => {
  const at = (
    stage: string | null,
    status = "DOCUMENT_PENDING",
    submitted?: Date,
  ) =>
    clientProgress({
      status,
      intakeStage: stage,
      candidateAccess: submitted ? [{ completedAt: submitted }] : [],
    });
  assert.equal(at("INTAKE", "CONSENT_PENDING").stage, "WAITING_CANDIDATE");
  assert.equal(at("INTAKE").label, "Waiting for the candidate's documents");
  const done = new Date("2026-11-04T06:00:00Z");
  // The candidate finished but no one has picked the case up yet: still "received".
  assert.deepEqual(
    [
      at("INTAKE", "DOCUMENT_PENDING", done).stage,
      at("INTAKE", "DOCUMENT_PENDING", done).candidateSubmittedAt,
    ],
    ["DOCUMENTS_RECEIVED", done],
  );
  assert.equal(at("DATA_ENTRY").stage, "DOCUMENTS_RECEIVED");
  assert.equal(at("CLIENT_REVIEW").stage, "YOUR_REVIEW");
  assert.equal(at("CORRECTION").stage, "CORRECTION");
  assert.equal(at("ROUTED", "IN_PROGRESS", done).stage, null);
  // Internal stage names never reach the client.
  assert.equal(JSON.stringify(at("DATA_ENTRY")).includes("DATA_ENTRY"), false);
});

void test("the client sees each document's latest clean file, nothing internal", () => {
  const detail = presentCaseDetail(
    {
      ...row({}),
      status: "DOCUMENT_PENDING",
      intakeStage: "DATA_ENTRY",
      candidateAccess: [{ completedAt: new Date("2026-11-04T06:00:00Z") }],
      documents: [
        {
          publicId: "doc-1",
          type: "AADHAAR",
          status: "UPLOADED",
          currentVersion: 2,
          versions: [
            {
              version: 2,
              originalName: "aadhaar-new.pdf",
              contentType: "application/pdf",
              sizeBytes: 2048n,
              sha256: "a".repeat(64),
              malwareState: "PENDING",
              createdAt: new Date("2026-11-04T06:00:00Z"),
            },
            {
              version: 1,
              originalName: "aadhaar.pdf",
              contentType: "application/pdf",
              sizeBytes: 1024n,
              sha256: "b".repeat(64),
              malwareState: "CLEAN",
              createdAt: new Date("2026-11-03T06:00:00Z"),
            },
          ],
        },
      ],
    },
    client,
  ) as {
    clientProgress: { stage: string };
    documents: Array<{ versions: Array<Record<string, unknown>> }>;
  };
  assert.equal(detail.clientProgress.stage, "DOCUMENTS_RECEIVED");
  assert.deepEqual(detail.documents[0]!.versions, [
    {
      version: 1,
      originalName: "aadhaar.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      createdAt: new Date("2026-11-03T06:00:00Z"),
    },
  ]);
});
