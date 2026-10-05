import type { Page } from "@playwright/test";
import { clientWorkspaceFixture } from "./client-workspace-fixture";

export async function clientPagesFixture(page: Page) {
  const base = await clientWorkspaceFixture(page);
  const now = new Date().toISOString();
  const requests: Array<{ path: string; query: string; method: string }> = [];
  const submitted: unknown[] = [];
  let failure = "";
  let empty = "";
  let delay = 0;
  const reports = Array.from({ length: 22 }, (_, i) => ({
    id: `report-${i}`,
    status: "PUBLISHED",
    currentVersion: 1,
    canDownload: i !== 2,
    publishedAt: now,
    case: {
      id: "client-case-1",
      caseNumber: `SG-REPORT-${i}`,
      subject: { fullName: `Report Candidate ${i}` },
    },
    latestVersion: {
      version: 1,
      authenticityCode: `AUTH-${i}`,
      sha256: "test-hash",
      generatedAt: now,
    },
  }));
  const invoices = Array.from({ length: 23 }, (_, i) => ({
    id: `invoice-${i}`,
    invoiceNumber: `INV-${i}`,
    status: i % 2 ? "PAID" : "OVERDUE",
    currency: "INR",
    totalAmount: 1180,
    paidAmount: i % 2 ? 1180 : 180,
    creditedAmount: 0,
    balance: i % 2 ? 0 : 1000,
    issuedAt: now,
    dueAt: now,
  }));
  const support = Array.from({ length: 12 }, (_, i) => ({
    id: `support-${i}`,
    requestNumber: `SUP-${i}`,
    subject: `Upload question ${i}`,
    caseNumber: null,
    status: i ? "OPEN" : "RESOLVED",
    reply: i ? null : "Please upload the clearer original.",
    createdAt: now,
    updatedAt: now,
    resolvedAt: i ? null : now,
  }));
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const handled =
      path === "/reports" ||
      path.startsWith("/reports/report-") ||
      path.startsWith("/client-finance/") ||
      path === "/support-requests" ||
      path === "/dashboards/client" ||
      path === "/dashboards/exceptions";
    if (!handled) return route.fallback();
    requests.push({ path, query: url.search, method: route.request().method() });
    if (path === failure)
      return route.fulfill({ status: 503, json: { title: "Test service unavailable" } });
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const reply = (json: unknown) => route.fulfill({ json });
    if (path.endsWith("/content") || path.endsWith("/pdf"))
      return route.fulfill({
        contentType: "application/pdf",
        body: "%PDF-1.4 isolated browser fixture",
      });
    if (path === "/client-finance/statement")
      return route.fulfill({ contentType: "text/csv", body: "Date,Amount\n2026-10-01,1180\n" });
    if (path === "/reports" || path === "/client-finance/invoices") {
      const data = path === "/reports" ? reports : invoices;
      const search = url.searchParams.get("search")?.toLowerCase() ?? "";
      const status = url.searchParams.get("status");
      const filtered =
        path === empty
          ? []
          : data.filter(
              (item) =>
                JSON.stringify(item).toLowerCase().includes(search) &&
                (!status || item.status === status),
            );
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return reply({
        items: filtered.slice(offset, offset + limit),
        nextCursor: offset + limit < filtered.length ? String(offset + limit) : null,
      });
    }
    if (path === "/client-finance/overview")
      return reply({
        summary: {
          invoiceCount: 23,
          openInvoiceCount: 12,
          billed: 27140,
          collected: 15140,
          credited: 0,
          outstanding: 12000,
          overdueAmount: 12000,
          overdueCount: 12,
        },
        ageing: [{ label: "1–30 days", value: 12000 }],
        generatedAt: now,
      });
    if (path === "/support-requests") {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        submitted.push(body);
        const item = { ...support[1]!, id: "new-request", requestNumber: "SUP-NEW", ...body };
        support.unshift(item);
        return reply(item);
      }
      const current = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      return reply({
        items: path === empty ? [] : support.slice((current - 1) * pageSize, current * pageSize),
        total: path === empty ? 0 : support.length,
        page: current,
        pageSize,
      });
    }
    if (path === "/dashboards/exceptions")
      return reply({
        summary: { clientActions: 11 },
        overdue: [],
        fieldVisits: [],
        rejectedDocuments: [
          {
            id: "rejected",
            type: "EDUCATION",
            updatedAt: now,
            case: {
              publicId: "client-case-1",
              caseNumber: "SG-TEST-1",
              subject: { fullName: "Candidate 1" },
            },
          },
        ],
        clarifications: Array.from({ length: 11 }, (_, i) => ({
          id: `clarification-${i}`,
          subject: `Confirm education ${i}`,
          status: i === 10 ? "RESPONDED" : "OPEN",
          createdAt: now,
          updatedAt: now,
          case: {
            publicId: "client-case-1",
            caseNumber: "SG-TEST-1",
            subject: { fullName: "Candidate 1" },
          },
        })),
        generatedAt: now,
      });
    return reply({
      summary: {
        totalChecks: 10,
        returnedOutcomes: 8,
        nonClear: 2,
        nonClearRate: 25,
        rejectedDocuments: 1,
        qaRework: 1,
      },
      bottleneck: { status: "DOCUMENT_PENDING", count: 3, oldestAgeHours: 36 },
      stageHealth: [{ status: "DOCUMENT_PENDING", count: 3, oldestAgeHours: 36 }],
      checkHealth: [
        {
          type: "EDUCATION",
          total: 10,
          completed: 8,
          pending: 2,
          returned: 8,
          clear: 6,
          discrepancies: 1,
          unableToVerify: 1,
        },
      ],
      documentHealth: [{ type: "EDUCATION", total: 3, available: 1, verified: 1, rejected: 1 }],
      qaDecisions: { APPROVE: 2, RETURN: 1 },
      generatedAt: now,
      branches: [
        {
          id: "noida",
          name: "Noida",
          city: "Noida",
          total: 10,
          active: 3,
          completed: 7,
          cancelled: 0,
          overdue: 1,
          pendingDocuments: 2,
          clarifications: 1,
          completionPercent: 70,
        },
      ],
    });
  });
  return {
    ...base,
    requests,
    submitted,
    fail: (value: string) => {
      failure = value;
    },
    empty: (value: string) => {
      empty = value;
    },
    delay: (value: number) => {
      delay = value;
    },
  };
}
