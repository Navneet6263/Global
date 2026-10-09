import type { Page } from "@playwright/test";

/** Browser-only RM workspace fixture: the read-only /spoc API with synthetic data. */
export async function spocFixture(page: Page) {
  const now = Date.now();
  const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  const clients = [
    ["c-1", "NSL", "Northstar Labs", 16, 2],
    ["c-2", "CDR", "Cedar Retail", 10, 1],
    ["c-3", "HZT", "Horizon Tech", 9, 1],
    ["c-4", "EFD", "Eastline Foods", 7, 0],
  ] as const;
  const cases = Array.from({ length: 14 }, (_, index) => ({
    id: `case-${index}`,
    caseNumber: `SG-2026100${index}-${(1000 + index).toString(16).toUpperCase()}`,
    externalRef: null,
    status: ["DOCUMENT_PENDING", "IN_PROGRESS", "QA_REVIEW", "MANAGER_REVIEW"][index % 4],
    holderRole: ["CLIENT_ADMIN", "VERIFIER", "QA_REVIEWER", "OPS_MANAGER"][index % 4],
    currentOwner: ["Candidate", "Neeraj Verifier", "QC Team", "Riya Mehta"][index % 4],
    priority: index % 5 ? "NORMAL" : "URGENT",
    riskLevel: null,
    dueAt: iso(index % 3 ? 20 + index : -3),
    createdAt: iso(-48 - index),
    updatedAt: iso(-index),
    completedAt: null,
    overdue: index % 3 === 0,
    candidateName: ["Aarav Shah", "Tara Kapoor", "Dev Malhotra", "Isha Verma", "Naina Das"][
      index % 5
    ],
    client: { id: clients[index % 4]![0], displayName: clients[index % 4]![2] },
    branch: { name: "Pune", city: "Pune" },
    opsOwner: "Riya Mehta",
    checksCompleted: index % 4,
    checksTotal: 4,
    blockedTasks: index % 6 ? 0 : 1,
    openVisits: 0,
  }));
  const overview = {
    generatedAt: iso(0),
    window: { from: iso(-720), to: iso(0) },
    kpis: {
      activeCases: 42,
      overdue: 4,
      slaApproaching: 6,
      unassigned: 3,
      completed: 18,
      qaRework: 2,
      openClientActions: 5,
      outstanding: 245000,
      overdueReceivable: 48000,
      openPipeline: 480000,
    },
    roles: (
      [
        ["OPS_MANAGER", 12],
        ["VERIFIER", 18],
        ["QA_REVIEWER", 7],
        ["CLIENT_ADMIN", 5],
        ["FINANCE_MANAGER", 4],
      ] as const
    ).map(([role, total]) => ({
      role,
      basis: "Cases held",
      total,
      pending: Math.round(total / 3),
      inProgress: Math.round(total / 2),
      completed: 3,
      overdue: role === "VERIFIER" ? 2 : 0,
      exceptions: role === "QA_REVIEWER" ? 1 : 0,
    })),
    workflow: [
      ["CONSENT_PENDING", "CLIENT_ADMIN", 3],
      ["DOCUMENT_PENDING", "CLIENT_ADMIN", 5],
      ["IN_PROGRESS", "VERIFIER", 18],
      ["QA_REVIEW", "QA_REVIEWER", 7],
      ["MANAGER_REVIEW", "OPS_MANAGER", 3],
      ["REPORT_PENDING", "OPS_MANAGER", 4],
    ].map(([status, holderRole, count]) => ({
      status,
      holderRole,
      count,
      oldestAgeHours: 30,
      atRisk: status === "IN_PROGRESS" ? 2 : 0,
    })),
    attention: cases.slice(0, 5).map((row, index) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      priority: row.priority,
      riskLevel: "LOW",
      dueAt: row.dueAt,
      updatedAt: row.updatedAt,
      subject: { fullName: row.candidateName },
      client: { publicId: row.client.id, displayName: row.client.displayName },
      owner: { publicId: "u-1", displayName: "Riya Mehta" },
      reasons: index % 2 ? ["SLA approaching"] : ["Overdue"],
      severity: 5 - index,
      ageHours: 30 + index,
      holderRole: row.holderRole,
    })),
    business: {
      crm: { openPipeline: 6, weightedForecast: 480000, closedWon: 3, winRate: 0.42 },
      finance: { billed: 920000, collected: 675000, outstanding: 245000, overdue: 48000 },
    },
  };
  const page$ = <T>(items: T[], url: URL) => {
    const pageNo = Number(url.searchParams.get("page") ?? 1);
    const size = Number(url.searchParams.get("pageSize") ?? 10);
    return {
      items: items.slice((pageNo - 1) * size, pageNo * size),
      total: items.length,
      page: pageNo,
      pageSize: size,
    };
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/auth/me")
      return reply({
        id: "user-rm",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Riya Mehta",
        email: "riya@example.invalid",
        roles: ["SPOC_RM"],
        permissions: ["dashboard:read", "case:read", "notification:read", "vendor:assign"],
        clientScope: clients.map(([id, , name]) => ({ id, name })),
        mustChangePassword: false,
      });
    if (path === "/auth/refresh") return route.fulfill({ status: 401, json: {} });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({
        counts: {
          rmActive: 48,
          rmNeedsDataEntry: 3,
          rmReady: 4,
          rmFinal: 3,
          rmCorrections: 5,
          rmOverdue: 4,
          rmEscalated: 2,
        },
        generatedAt: iso(0),
      });
    if (path === "/spoc/overview") return reply(overview);
    if (path === "/spoc/filters")
      return reply({
        clients: clients.map(([id, , displayName]) => ({ id, displayName, status: "ACTIVE" })),
        branches: [{ id: "b-1", name: "Pune", city: "Pune" }],
        users: [{ id: "u-1", displayName: "Riya Mehta", roles: ["SPOC_RM"] }],
      });
    if (path === "/spoc/clients")
      return reply(
        page$(
          clients.map(([id, code, displayName, active, overdue]) => ({
            id,
            code,
            displayName,
            status: "ACTIVE",
            creditHold: false,
            total: active + 6,
            active,
            waitingOnClient: Math.round(active / 4),
            completed: 6,
            overdue,
            openClarifications: overdue,
            outstanding: active * 4000,
            overdueAmount: overdue * 6000,
            onboardingHandoffAt: null,
          })),
          url,
        ),
      );
    if (path === "/spoc/exceptions")
      return reply({
        ...page$(
          cases.slice(0, 4).map((row) => ({
            id: `ex-${row.id}`,
            title: `${row.caseNumber} · ${row.candidateName}`,
            subtitle: row.client.displayName,
            caseId: row.id,
            status: row.status,
            owner: "Riya Mehta",
            dueAt: row.dueAt,
            updatedAt: row.updatedAt,
          })),
          url,
        ),
        category: url.searchParams.get("category") ?? "overdue",
        categories: [
          { category: "overdue", count: 4 },
          { category: "sla_approaching", count: 6 },
          { category: "client_clarifications", count: 5 },
          { category: "qa_rework", count: 2 },
        ],
      });
    if (path === "/spoc/cases") return reply(page$(cases, url));
    if (path.startsWith("/spoc/")) return reply(page$([], url));
    return reply({ items: [], total: 0 });
  });
}
