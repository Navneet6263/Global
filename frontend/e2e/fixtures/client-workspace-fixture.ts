import type { Page } from "@playwright/test";

export async function clientWorkspaceFixture(
  page: Page,
  canCreate = true,
  profile: { displayName?: string; clientName?: string } = {},
) {
  const unexpected: string[] = [];
  const requests: URL[] = [];
  const escalations: Array<{ version?: number; reason: string }> = [];
  let failed = false;
  let delay = 0;
  let loggedOut = false;
  const now = new Date().toISOString();
  const statuses = ["DOCUMENT_PENDING", "IN_PROGRESS", "COMPLETED", "QA_REVIEW", "CANCELLED"];
  const items = Array.from({ length: 23 }, (_, i) => ({
    id: `client-case-${i + 1}`,
    caseNumber: `SG-TEST-${i + 1}`,
    status: statuses[i % statuses.length],
    priority: "NORMAL",
    version: 1,
    createdAt: now,
    updatedAt: now,
    dueAt: null,
    subject: { publicId: `subject-${i}`, fullName: `Candidate ${i + 1}` },
    client: { publicId: "test-client", code: "TEST", displayName: "Test Client" },
    checks: [{ publicId: `check-${i}`, type: "EDUCATION", status: "COMPLETED" }],
    documents: [],
    consents: [],
    clarifications: [],
    qaReviews: [],
    reports: [],
    statusHistory: [],
    // Completed cases have a released report the client can download.
    report:
      statuses[i % statuses.length] === "COMPLETED"
        ? {
            id: `report-${i + 1}`,
            version: 1,
            releasedAt: now,
            downloadExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          }
        : null,
  }));
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const path = url.pathname.replace("/api/v1", "");
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/auth/logout") {
      loggedOut = true;
      return reply({ authenticated: false });
    }
    if (loggedOut && (path === "/auth/me" || path === "/auth/refresh"))
      return route.fulfill({ status: 401, json: { title: "Signed out" } });
    if (path === "/auth/me")
      return reply({
        id: "client-user",
        tenantId: "test-tenant",
        tenantName: "Test Company",
        clientId: "test-client",
        clientName: profile.clientName ?? "Test Client",
        displayName: profile.displayName ?? "Client Tester",
        email: "client@example.invalid",
        roles: ["CLIENT_ADMIN"],
        mustChangePassword: false,
        permissions: [
          "case:read",
          "dashboard:read",
          "report:read",
          "notification:read",
          "support:request",
          ...(canCreate ? ["case:create"] : []),
        ],
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/client-account/relationship-manager")
      return reply({
        rm: {
          name: "Niku Sharma",
          email: "niku@saplingglobal.example",
          phone: "+919876543210",
          since: "2026-10-07T10:00:00Z",
        },
      });
    if (path === "/dashboards/navigation") return reply({ counts: { clientActions: 1 } });
    if (path === "/dashboards/operations")
      return reply({
        summary: { total: 23, overdue: 0, createdToday: 23, completedToday: 5 },
        statusMix: Object.fromEntries(
          statuses.map((status) => [status, items.filter((item) => item.status === status).length]),
        ),
        outcomeMix: { CLEAR: 12, DISCREPANCY: 3, UNABLE_TO_VERIFY: 1 },
        trend: [],
        recentCases: items.slice(0, 6),
        generatedAt: now,
      });
    if (path === "/dashboards/exceptions")
      return reply({
        summary: { clientActions: 1, rejectedDocuments: 0 },
        overdue: [],
        fieldVisits: [],
        rejectedDocuments: [],
        clarifications: [
          {
            id: "clarification-1",
            status: "OPEN",
            subject: "Upload clearer certificate",
            case: {
              publicId: items[0]!.id,
              caseNumber: items[0]!.caseNumber,
              subject: items[0]!.subject,
            },
          },
        ],
        generatedAt: now,
      });
    if (path === "/cases/export")
      return route.fulfill({ contentType: "text/csv", body: "caseNumber\nSG-TEST-1\n" });
    if (path === "/cases") {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      if (failed) return route.fulfill({ status: 503, json: { title: "Test queue unavailable" } });
      const status = url.searchParams.get("status");
      const q = url.searchParams.get("search")?.toLowerCase();
      const filtered = items.filter(
        (item) =>
          (!status || item.status === status) &&
          (!q || `${item.subject.fullName} ${item.caseNumber}`.toLowerCase().includes(q)),
      );
      const currentPage = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 6);
      const start = (currentPage - 1) * pageSize;
      return reply({
        items: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page: currentPage,
        pageSize,
        nextCursor: null,
      });
    }
    if (/^\/cases\/[^/]+\/clarifications$/.test(path)) return reply({ items: [] });
    if (/^\/cases\/[^/]+\/client-escalation$/.test(path)) {
      const id = path.split("/")[2]!;
      const target = items.find((item) => item.id === id) as Record<string, unknown> | undefined;
      const body = route.request().postDataJSON() as { reason: string };
      escalations.push(body);
      if (target) target.clientEscalation = { at: now, reason: body.reason };
      return reply({ id, escalated: true, escalatedAt: now, version: 2 });
    }
    if (/^\/cases\/[^/]+$/.test(path)) return reply(items.find((item) => path.endsWith(item.id)));
    if (/^\/reports\/report-\d+\/content$/.test(path))
      return route.fulfill({
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4\n%%EOF\n"),
      });
    if (path === "/reports" || path === "/clarifications")
      return reply({ items: [], total: 0, nextCursor: null });
    unexpected.push(path);
    return route.fulfill({ status: 404, json: { title: `Unmocked test endpoint: ${path}` } });
  });
  return {
    requests,
    escalations,
    unexpected,
    fail: (value: boolean) => {
      failed = value;
    },
    delay: (value: number) => {
      delay = value;
    },
  };
}
