import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import { presentCaseListItem } from "../src/cases/case.presenter";

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
