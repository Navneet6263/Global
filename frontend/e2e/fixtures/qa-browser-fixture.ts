import type { Page } from "@playwright/test";
import type { QaQueueItem } from "../../src/lib/backend-api/qa";
import { PIXEL_PNG, sampleReportView } from "./report-view";

// Browser contract fixture only. It is not imported by the application or stored in the DB.
export async function qaBrowserFixture(
  page: Page,
  evidence: Partial<Pick<QaQueueItem, "documents" | "fieldVisits">> = {},
) {
  const reviewerId = "00000000-0000-4000-8000-000000000077";
  const details: string[] = [];
  const unexpected: string[] = [];
  const exports: unknown[] = [];
  const views: string[] = [];
  let version = 1;
  let claimed = false;
  let renewGate: Promise<void> | undefined;
  let resumeRenew = () => {};
  const row = (id = "qa-case-1", correction = false) => ({
    id,
    caseNumber: id === "qa-case-1" ? "QA-TEST-001" : "QA-TEST-002",
    priority: "HIGH",
    dueAt: new Date(Date.now() + 3600000).toISOString(),
    version,
    createdAt: new Date().toISOString(),
    status: correction ? "IN_PROGRESS" : "QA_REVIEW",
    qaReviewer: claimed ? { publicId: reviewerId, displayName: "Test QA Reviewer" } : null,
    qaClaimedAt: claimed ? new Date().toISOString() : null,
    claimActive: claimed,
    subject: {
      publicId: "subject-1",
      fullName: id === "qa-case-1" ? "QA Test Candidate" : "Second Test Candidate",
    },
    client: { publicId: "client-1", displayName: "QA Test Organisation" },
    checkCount: 1,
    completedCheckCount: correction ? 0 : 1,
    documentCount: 0,
    highestRisk: null,
    correctionReason: correction ? "Reconfirm the employment source." : null,
  });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const reply = (data: unknown) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: reviewerId,
        tenantId: "tenant-test-qa",
        tenantName: "QA Contract Test",
        email: "qa@example.invalid",
        displayName: "Test QA Reviewer",
        mustChangePassword: false,
        roles: ["QA_REVIEWER"],
        permissions: ["qa:review", "case:read", "document:read", "notification:read"],
      });
    if (path === "/notifications") return reply({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === "/audit-events/exports" && route.request().method() === "POST") {
      exports.push(JSON.parse(route.request().postData() ?? "{}") as unknown);
      return reply({ logged: true });
    }
    if (path === "/qa/register") {
      const view = url.searchParams.get("view") ?? "all";
      views.push(view);
      const items =
        view === "corrections"
          ? [row("qa-case-1", true)]
          : (view === "mine" && !claimed) || (view === "available" && claimed)
            ? []
            : [row(), row("qa-case-2")];
      return reply({
        items,
        total: items.length,
        page: 1,
        pageSize: 25,
        summary: { awaiting: 2, overdue: 0, highRisk: 0, claimed: claimed ? 1 : 0 },
      });
    }
    if (path === "/qa/dashboard") {
      const day = 86_400_000;
      const pattern = [3, 5, 2, 0, 4, 6, 5, 1, 0, 4, 7, 5, 3, 2];
      return reply({
        generatedAt: new Date().toISOString(),
        queue: {
          awaiting: 12,
          available: 7,
          mine: 2,
          reservedByOthers: 3,
          highRisk: 2,
          sla: { overdue: 2, dueToday: 4, later: 5, noDueDate: 1 },
          waiting: { under4h: 5, under24h: 4, under3d: 2, over3d: 1 },
        },
        me: {
          today: 2,
          week: 27,
          previousWeek: 22,
          approved30: 61,
          returned30: 9,
          approvalRate: 87,
          medianReviewMinutes: 42,
        },
        teamToday: 11,
        trend: pattern.map((total, index) => ({
          date: new Date(Date.now() - (13 - index) * day).toISOString().slice(0, 10),
          approved: total - (index % 4 === 0 && total ? 1 : 0),
          returned: index % 4 === 0 && total ? 1 : 0,
        })),
        upNext: [
          {
            id: "qa-case-1",
            caseNumber: "QA-TEST-001",
            candidateName: "QA Test Candidate",
            clientName: "QA Test Organisation",
            priority: "HIGH",
            dueAt: new Date(Date.now() - 5 * 3_600_000).toISOString(),
            checks: 4,
            highRisk: true,
            reservedByMe: false,
            waitingHours: 30,
          },
          {
            id: "qa-case-2",
            caseNumber: "QA-TEST-002",
            candidateName: "Second Test Candidate",
            clientName: "QA Test Organisation",
            priority: "NORMAL",
            dueAt: new Date(Date.now() + 20 * 3_600_000).toISOString(),
            checks: 3,
            highRisk: false,
            reservedByMe: false,
            waitingHours: 3,
          },
        ],
        reworkByType: [
          { type: "EMPLOYMENT", count: 5 },
          { type: "ADDRESS", count: 3 },
          { type: "EDUCATION", count: 1 },
        ],
        recent: [
          {
            id: "decision-1",
            decision: "REWORK",
            createdAt: new Date(Date.now() - 40 * 60_000).toISOString(),
            caseId: "qa-case-1",
            caseNumber: "QA-TEST-001",
            caseStatus: "IN_PROGRESS",
            candidateName: "QA Test Candidate",
            clientName: "QA Test Organisation",
          },
          {
            id: "decision-2",
            decision: "APPROVED",
            createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
            caseId: "qa-case-9",
            caseNumber: "QA-TEST-009",
            caseStatus: "MANAGER_REVIEW",
            candidateName: "Earlier Candidate",
            clientName: "QA Test Organisation",
          },
        ],
      });
    }
    if (path === "/qa/history")
      return reply({
        items: [
          {
            publicId: "decision-1",
            decision: "REWORK",
            notes: "Reconfirm the employment source.",
            createdAt: new Date().toISOString(),
            case: {
              publicId: "qa-case-1",
              caseNumber: "QA-TEST-001",
              status: "IN_PROGRESS",
              subject: { fullName: "QA Test Candidate" },
              client: { displayName: "QA Test Organisation" },
              reports: [],
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });
    if (/^\/qa\/cases\/qa-case-\d$/.test(path)) {
      const id = path.split("/").at(-1)!;
      details.push(id);
      return reply({
        ...row(id),
        checks: [
          {
            publicId: "check-1",
            type: "EMPLOYMENT",
            status: "COMPLETED",
            result: "CLEAR",
            riskLevel: null,
            updatedAt: new Date().toISOString(),
            sourceSummary: "Authorised source was reviewed.",
            findings: [],
            tasks: [],
          },
        ],
        documents: evidence.documents ?? [],
        fieldVisits: evidence.fieldVisits ?? [],
      });
    }
    if (/^\/cases\/qa-case-\d\/report-view$/.test(path)) {
      const id = path.split("/")[2]!;
      return reply(
        sampleReportView(url.searchParams.get("audience") === "client" ? "client" : "internal", {
          caseNumber: id === "qa-case-1" ? "QA-TEST-001" : "QA-TEST-002",
          candidateName: id === "qa-case-1" ? "QA Test Candidate" : "Second Test Candidate",
          checkId: "check-1",
        }),
      );
    }
    if (path === "/checks/check-1/evidence/proof-1")
      return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL_PNG });
    if (/\/qa\/cases\/qa-case-\d\/(claim|renew|release)$/.test(path)) {
      const action = path.split("/").at(-1);
      if (action === "renew") await renewGate;
      claimed = action !== "release";
      version += 1;
      return reply({ id: "qa-case-1", caseVersion: version, claimedBy: reviewerId });
    }
    unexpected.push(path);
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ title: `Unexpected test request: ${path}` }),
    });
  });
  return {
    exports,
    details,
    unexpected,
    views,
    pauseRenew() {
      renewGate = new Promise<void>((resolve) => {
        resumeRenew = resolve;
      });
    },
    resumeRenew() {
      resumeRenew();
    },
  };
}
