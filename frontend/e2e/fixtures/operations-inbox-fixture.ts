import type { Page } from "@playwright/test";

export async function operationsInboxFixture(page: Page, canWrite = true) {
  const requests: URL[] = [];
  let documentCases = 9;
  let fail = false;
  const counts: Record<string, number> = {
    documents: 9,
    start: 2,
    checks: 3,
    field_assignment: 1,
    field_review: 1,
    clarifications: 1,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const path = url.pathname.replace("/api/v1", "");
    const reply = (data: unknown) => route.fulfill({ json: data });
    if (path === "/auth/me")
      return reply({
        id: "ops-test",
        tenantId: "tenant-test",
        tenantName: "Test Workspace",
        displayName: "Test Operations",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: canWrite ? ["*"] : ["case:read", "dashboard:read"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/dashboards/operations")
      return reply({
        summary: { total: 12, overdue: 1, createdToday: 2, completedToday: 1 },
        statusMix: {},
        stageHealth: [],
        outcomeMix: {},
        trend: [],
        recentCases: [],
        generatedAt: new Date().toISOString(),
      });
    if (path === "/dashboards/executive")
      return reply({
        forecast: { unassignedActive: 2, dueNext7Days: 2 },
        performanceTrend: [],
        attentionQueue: [],
      });
    if (path === "/dashboards/exceptions") return reply({ summary: { clarifications: 1 } });
    if (path === "/dashboards/operations/actions") {
      if (fail) return route.fulfill({ status: 503, json: { title: "Temporarily unavailable" } });
      const action = url.searchParams.get("action") ?? "documents";
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const search = url.searchParams.get("search") ?? "";
      const total =
        search === "missing" ? 0 : action === "documents" ? documentCases : (counts[action] ?? 0);
      const currentPage = Math.min(requestedPage, Math.max(1, Math.ceil(total / 8)));
      return reply({
        action,
        page: currentPage,
        pageSize: 8,
        total,
        generatedAt: new Date().toISOString(),
        summary: Object.entries(counts).map(([kind, count]) => ({
          action: kind,
          cases: kind === "documents" ? documentCases : count,
          quantity: kind === "documents" ? documentCases + (documentCases ? 3 : 0) : count,
        })),
        items: Array.from(
          { length: Math.max(0, Math.min(8, total - (currentPage - 1) * 8)) },
          (_, i) => ({
            id: `inbox-case-${(currentPage - 1) * 8 + i + 1}`,
            caseNumber: `SG-INBOX-${(currentPage - 1) * 8 + i + 1}`,
            candidateName: `Candidate ${(currentPage - 1) * 8 + i + 1}`,
            clientName: "Test Organisation",
            status: action === "start" ? "DOCUMENT_PENDING" : "IN_PROGRESS",
            priority: "NORMAL",
            version: 1,
            dueAt: "2026-09-01T00:00:00Z",
            activityAt: "2026-09-10T06:00:00Z",
            quantity: 1,
            checksComplete: 1,
          }),
        ),
      });
    }
    if (/^\/cases\/inbox-case-\d+$/.test(path))
      return reply({
        id: path.split("/").at(-1),
        caseNumber: "SG-INBOX-1",
        status: "IN_PROGRESS",
        priority: "NORMAL",
        version: 1,
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-10T06:00:00Z",
        subject: { publicId: "test-subject", fullName: "Candidate 1" },
        client: { publicId: "test-client", displayName: "Test Organisation" },
        checks: [
          {
            publicId: "check-1",
            type: "ADDRESS",
            status: "COMPLETED",
            result: "CLEAR",
            version: 1,
            tasks: [],
          },
        ],
        documents: [],
        consents: [],
        clarifications: [],
        qaReviews: [],
        reports: [],
        services: [],
        statusHistory: [],
        fieldVisits: [],
      });
    if (path.endsWith("/field-assignees")) return reply({ items: [], total: 0 });
    if (path.endsWith("/evidence-readiness"))
      return reply({ ready: false, issues: [], requiredTypes: [] });
    if (path.endsWith("/reports")) return reply({ items: [] });
    return route.fulfill({ status: 500, json: { title: `Unexpected ${path}` } });
  });
  return {
    requests,
    clearDocuments: () => {
      documentCases = 0;
    },
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
