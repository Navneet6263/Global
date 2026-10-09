import type { Page } from "@playwright/test";

/** Browser-only Operations overview fixture. All data is synthetic; no backend is contacted. */
export async function operationsOverviewFixture(page: Page, canWrite = true) {
  const requests: Array<{ method: string; path: string; query: URLSearchParams; body?: unknown }> =
    [];
  const owners: Record<string, { publicId: string; displayName: string } | null> = {};
  const now = Date.now();
  const iso = (offsetHours: number) => new Date(now + offsetHours * 3_600_000).toISOString();
  const statuses = ["DOCUMENT_PENDING", "CLARIFICATION_PENDING", "IN_PROGRESS", "QA_REVIEW"];
  const cases = Array.from({ length: 14 }, (_, i) => {
    const id = `ops-case-${i + 1}`;
    owners[id] ??= i < 2 ? null : { publicId: "rm-riya", displayName: "Riya Mehta" };
    return {
      id,
      caseNumber: `SG-OPS-${String(i + 1).padStart(3, "0")}`,
      status: statuses[i % statuses.length]!,
      priority: "NORMAL",
      dueAt: i === 2 ? iso(-2) : iso(4 + i),
      version: 3,
      createdAt: iso(-48),
      updatedAt: iso(-1),
      subject: { publicId: `subject-${i}`, fullName: `Ops Candidate ${i + 1}` },
      client: {
        publicId: i % 2 ? "client-cedar" : "client-horizon",
        code: "TEST",
        displayName: i % 2 ? "Cedar Retail" : "Horizon Tech",
      },
      checks: [
        {
          publicId: `check-${i}`,
          type: "EMPLOYMENT",
          status: "IN_PROGRESS",
          tasks:
            i % 4 === 2
              ? [
                  {
                    publicId: `task-${i}`,
                    status: "IN_PROGRESS",
                    version: 1,
                    assignee: {
                      publicId: "v1",
                      displayName: "Neeraj Verifier",
                      email: "v@x.invalid",
                    },
                  },
                ]
              : [],
        },
      ],
    };
  });
  const listed = () => cases.map((item) => ({ ...item, assignedOpsUser: owners[item.id] }));

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    requests.push({ method: request.method(), path, query: url.searchParams, body });
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/auth/me")
      return reply({
        id: "ops-test",
        tenantId: "tenant-test",
        tenantName: "Sapling Global",
        displayName: "Ananya Rao",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: canWrite
          ? ["*"]
          : ["case:read", "dashboard:read", "client:read", "user:read", "clarification:read"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({
        counts: {
          opsActiveCases: 14,
          opsUnassigned: 2,
          opsSlaRisk: 1,
          opsClarifications: 3,
          opsExceptions: 4,
          qaQueue: 3,
          opsStopped: 1,
          opsReopened: 0,
          opsClientsWithoutRm: 1,
        },
      });
    if (path === "/dashboards/operations")
      return reply({
        summary: { total: 14, overdue: 1, createdToday: 2, completedToday: 5 },
        statusMix: {},
        stageHealth: [],
        outcomeMix: {},
        trend: [],
        recentCases: [],
        generatedAt: new Date().toISOString(),
      });
    if (path === "/dashboards/executive")
      return reply({
        summary: { total: 14, overdue: 1, createdToday: 2, completedToday: 5 },
        statusMix: {},
        outcomeMix: { CLEAR: 42, DISCREPANCY: 5, UNABLE_TO_VERIFY: 3 },
        dispositionMix: { GREEN: 38, BLUE: 4, YELLOW: 3, RED: 2, AMBER: 2, CLIENT_REVIEW: 1 },
        caseColourMix: { GREEN: 12, YELLOW: 3, RED: 2, AMBER: 1, CLIENT_REVIEW: 1 },
        trend: [],
        recentCases: [],
        generatedAt: new Date().toISOString(),
        performance: { averageTatHours: 86, slaPercentage: 92, completedCases: 40 },
        performanceTrend: ["01 Jul", "01 Aug", "01 Sep"].map((month, i) => ({
          month,
          created: 20 + i * 4,
          slaPercentage: 86 + i * 3,
          averageTatHours: 90 - i * 5,
          overdue: 3 - i,
        })),
        riskMix: {},
        attentionQueue: [],
        clientPerformance: [
          {
            id: "client-horizon",
            name: "Horizon Tech",
            total: 30,
            active: 8,
            completed: 22,
            overdue: 1,
            slaPercentage: 94,
            averageTatHours: 80,
          },
          {
            id: "client-cedar",
            name: "Cedar Retail",
            total: 20,
            active: 6,
            completed: 14,
            overdue: 0,
            slaPercentage: 88,
            averageTatHours: 95,
          },
        ],
        branchPerformance: [],
        stageAgeing: [
          {
            status: "DOCUMENT_PENDING",
            count: 4,
            averageAgeHours: 30,
            oldestAgeHours: 70,
            atRisk: 1,
          },
          { status: "IN_PROGRESS", count: 6, averageAgeHours: 50, oldestAgeHours: 120, atRisk: 0 },
          { status: "QA_REVIEW", count: 3, averageAgeHours: 10, oldestAgeHours: 20, atRisk: 0 },
        ],
        teamCapacity: [
          { id: "rm-riya", name: "Riya Mehta", active: 12, completed: 30, overdue: 1 },
          { id: "unassigned", name: "Unassigned", active: 2, completed: 0, overdue: 0 },
        ],
        checkPerformance: [],
        businessHealth: {
          crm: { openPipeline: 0, weightedForecast: 0, closedWon: 0, winRate: null },
          finance: { billed: 0, collected: 0, outstanding: 0, overdue: 0 },
        },
        forecast: {
          dueNext7Days: 9,
          atRiskNext7Days: 2,
          projectedCompletions7Days: 7,
          unassignedActive: 2,
        },
        caseRegister: [],
        filters: {
          clients: [],
          branches: [],
          checkTypes: [],
          priorities: [],
          riskLevels: [],
          applied: {},
        },
      });
    if (path === "/workflow/clients" && request.method() === "GET")
      return reply({
        items: [
          {
            id: "client-cedar",
            code: "CEDAR",
            name: "Cedar Retail",
            version: 2,
            primaryRm: null,
            primaryRmAssignedAt: null,
            mappedRms: [{ id: "rm-riya", name: "Riya Mehta" }],
            openCases: 7,
            casesWithoutRm: 1,
          },
          {
            id: "client-horizon",
            code: "HORIZON",
            name: "Horizon Tech",
            version: 4,
            primaryRm: { id: "rm-riya", name: "Riya Mehta", active: true },
            primaryRmAssignedAt: iso(-200),
            mappedRms: [{ id: "rm-riya", name: "Riya Mehta" }],
            openCases: 7,
            casesWithoutRm: 1,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 15,
        counts: { withoutRm: 1 },
      });
    const companyRm = /^\/workflow\/clients\/([^/]+)\/rm$/.exec(path);
    if (companyRm && request.method() === "POST") return reply({ casesMoved: 1, version: 3 });
    const stop = /^\/workflow\/cases\/([^/]+)\/(stop|resume)$/.exec(path);
    if (stop && request.method() === "POST")
      return reply({ status: stop[2] === "stop" ? "STOPPED" : "IN_PROGRESS", version: 4 });
    if (path === "/clients")
      return reply({
        items: [
          { publicId: "client-cedar", displayName: "Cedar Retail" },
          { publicId: "client-horizon", displayName: "Horizon Tech" },
        ],
        nextCursor: null,
        total: 2,
      });
    if (path === "/workflow/clients/client-horizon/intake-rules" && request.method() === "PATCH")
      return reply({ id: "client-horizon", version: 5 });
    if (path === "/users" && new URL(request.url()).searchParams.get("role") === "DATA_ENTRY")
      return reply({
        items: [
          {
            id: "de-sara",
            displayName: "Sara Khan",
            email: "sara@example.invalid",
            status: "ACTIVE",
            roles: [{ code: "DATA_ENTRY", name: "Data Entry" }],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    if (path === "/users")
      return reply({
        items: [
          {
            id: "rm-riya",
            displayName: "Riya Mehta",
            email: "riya@example.invalid",
            status: "ACTIVE",
            roles: [{ code: "SPOC_RM", name: "SPOC RM" }],
            spocClients: [
              { id: "client-horizon", displayName: "Horizon Tech" },
              { id: "client-cedar", displayName: "Cedar Retail" },
            ],
          },
          {
            id: "rm-aman",
            displayName: "Aman Gupta",
            email: "aman@example.invalid",
            status: "ACTIVE",
            roles: [{ code: "SPOC_RM", name: "SPOC RM" }],
            spocClients: [{ id: "client-horizon", displayName: "Horizon Tech" }],
          },
        ],
        total: 2,
        page: 1,
        pageSize: 100,
      });
    if (path === "/cases" && request.method() === "GET") {
      let items = listed();
      if (url.searchParams.get("unassigned") === "true")
        items = items.filter((item) => !item.assignedOpsUser);
      const status = url.searchParams.get("status");
      if (status) items = items.filter((item) => item.status === status);
      const search = url.searchParams.get("search")?.toLowerCase();
      if (search)
        items = items.filter((item) => item.subject.fullName.toLowerCase().includes(search));
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const size = Number(url.searchParams.get("pageSize") ?? 6);
      return reply({
        items: items.slice((pageNumber - 1) * size, pageNumber * size),
        total: items.length,
        nextCursor: null,
        page: pageNumber,
        pageSize: size,
      });
    }
    const activity = /^\/cases\/([^/]+)\/activity$/.exec(path);
    if (activity)
      return reply({
        items: [
          {
            id: "event-1",
            action: "document.rejected",
            resourceType: "document",
            actorName: "Ankit Rao",
            createdAt: iso(-3),
          },
        ],
        nextCursor: null,
      });
    const owner = /^\/cases\/([^/]+)\/owner$/.exec(path);
    if (owner && request.method() === "PATCH") {
      const input = body as { ownerId: string };
      const name = input.ownerId === "rm-aman" ? "Aman Gupta" : "Riya Mehta";
      owners[owner[1]!] = { publicId: input.ownerId, displayName: name };
      return reply({ id: owner[1], owner: { id: input.ownerId, displayName: name }, version: 4 });
    }
    const escalation = /^\/cases\/([^/]+)\/escalation$/.exec(path);
    if (escalation && request.method() === "PATCH")
      return reply({ id: escalation[1], priority: "URGENT", version: 4, escalated: true });
    const detail = /^\/cases\/(ops-case-\d+)$/.exec(path);
    if (detail) {
      const item = listed().find((entry) => entry.id === detail[1]);
      if (!item) return route.fulfill({ status: 404, json: { title: "Case not found" } });
      return reply({
        ...item,
        statusHistory: [{ toStatus: item.status, createdAt: iso(-5) }],
        consents: [],
        documents: [
          {
            publicId: "doc-address",
            type: "ADDRESS_PROOF",
            status: "REJECTED",
            currentVersion: 2,
            version: 2,
            reviewNote: "Image unreadable",
            versions: [
              {
                version: 2,
                originalName: "address.pdf",
                contentType: "application/pdf",
                sizeBytes: "1000",
                sha256: "x",
                malwareState: "CLEAN",
                createdAt: iso(-4),
              },
            ],
          },
        ],
        clarifications: [],
        qaReviews: [],
        reports: [],
        fieldVisits: [],
        services: [],
      });
    }
    // Secondary case-workspace panels are not under test here; give them empty data.
    if (request.method() === "GET" && path.startsWith("/cases/"))
      return reply(
        path.endsWith("evidence-readiness")
          ? { ready: false, issues: [], requiredTypes: [] }
          : { items: [], total: 0 },
      );
    if (request.method() === "GET" && path === "/reports") return reply({ items: [], total: 0 });
    return route.fulfill({ status: 500, json: { title: `Unexpected ${path}` } });
  });
  return { requests };
}
