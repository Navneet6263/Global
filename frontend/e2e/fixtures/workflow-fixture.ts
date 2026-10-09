import type { Page } from "@playwright/test";

type Role = "RM" | "DATA_ENTRY" | "DATA_ENTRY_LEAD" | "TEAM_LEADER" | "OPS";

/**
 * Browser-only fixture for the RM -> Data Entry -> department flow. Synthetic data only;
 * state changes in memory so each action's effect on the next screen can be checked.
 */
export async function workflowFixture(page: Page, role: Role) {
  const requests: Array<{ method: string; path: string; body?: unknown; query?: string }> = [];
  const now = Date.now();
  const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  const state = {
    intakeStage: role === "RM" ? "READY" : "DATA_ENTRY",
    caseStatus: "DOCUMENT_PENDING",
    documentStatus: "UPLOADED",
    clarificationOpen: false,
    taskAssignee: null as null | { id: string; name: string },
    version: 3,
    /** Checks whose initiation details Data Entry saved. */
    initiated: new Map<string, string>(),
  };
  const departments = [
    {
      id: "dep-data",
      code: "DATA_ENTRY",
      name: "Data Entry",
      kind: "DATA_ENTRY",
      status: "ACTIVE",
      version: 1,
      checkTypes: [],
      waitingForAssignment: 0,
      members: [
        {
          id: "de-ankit",
          displayName: "Ankit Rao",
          email: "ankit@example.invalid",
          status: "ACTIVE",
          role: "LEAD",
          openWork: 2,
        },
        {
          id: "de-sara",
          displayName: "Sara Khan",
          email: "sara@example.invalid",
          status: "ACTIVE",
          role: "MEMBER",
          openWork: 0,
        },
      ],
    },
    {
      id: "dep-emp",
      code: "EMPLOYMENT",
      name: "Employment",
      kind: "VERIFICATION",
      status: "ACTIVE",
      version: 1,
      checkTypes: ["EMPLOYMENT"],
      waitingForAssignment: 1,
      members: [
        {
          id: "v-neeraj",
          displayName: "Neeraj Gupta",
          email: "neeraj@example.invalid",
          status: "ACTIVE",
          role: "LEAD",
          openWork: 1,
        },
        {
          id: "v-priya",
          displayName: "Priya Das",
          email: "priya@example.invalid",
          status: "ACTIVE",
          role: "MEMBER",
          openWork: 0,
        },
      ],
    },
    {
      id: "dep-edu",
      code: "EDUCATION",
      name: "Education",
      kind: "VERIFICATION",
      status: "ACTIVE",
      version: 1,
      checkTypes: ["EDUCATION"],
      waitingForAssignment: 0,
      members: [],
    },
  ];
  const queueCase = () => ({
    id: "flow-case-1",
    caseNumber: "SG-FLOW-001",
    status: state.caseStatus,
    priority: "NORMAL",
    version: state.version,
    workflowVersion: 2,
    intakeStage: state.intakeStage,
    dueAt: iso(30),
    createdAt: iso(-20),
    updatedAt: iso(-1),
    dataEntryAssignedAt: iso(-3),
    dataEntryReadyAt: state.intakeStage === "READY" ? iso(-1) : null,
    candidateName: "Kabir Sethi",
    client: { id: "client-horizon", name: "Horizon Tech" },
    rm: { id: "rm-riya", name: "Riya Mehta" },
    dataEntry: { id: "de-sara", name: "Sara Khan" },
    documents: { total: 1, rejected: state.documentStatus === "REJECTED" ? 1 : 0 },
    openInsufficiency: { l1: state.clarificationOpen ? 1 : 0, l2: 0 },
    checks: { total: 2, completed: 0, unassigned: 0, departments: [] },
  });
  const finalCase = {
    ...queueCase(),
    id: "flow-case-2",
    caseNumber: "SG-FLOW-002",
    status: "MANAGER_REVIEW",
    intakeStage: "ROUTED",
    candidateName: "Meera Joshi",
    escalation: { at: iso(-2), note: "Client: Joining date is Monday, report needed by Friday." },
  };
  const detail = () => ({
    id: "flow-case-1",
    caseNumber: "SG-FLOW-001",
    status: state.caseStatus,
    priority: "NORMAL",
    version: state.version,
    createdAt: iso(-20),
    updatedAt: iso(-1),
    dueAt: iso(30),
    subject: { publicId: "s1", fullName: "Kabir Sethi" },
    client: { publicId: "client-horizon", code: "H", displayName: "Horizon Tech" },
    assignedOpsUser: { publicId: "rm-riya", displayName: "Riya Mehta" },
    workflow: {
      version: 2,
      intakeStage: state.intakeStage,
      dataEntryAssignedAt: iso(-3),
      dataEntryReadyAt: null,
      dataEntryUser: { publicId: "de-sara", displayName: "Sara Khan" },
    },
    checks: ["chk-emp", "chk-edu"].map((publicId) => ({
      publicId,
      type: publicId === "chk-emp" ? "EMPLOYMENT" : "EDUCATION",
      status: "PENDING",
      tasks: [],
      initiatedAt: state.initiated.has(publicId) ? iso(0) : null,
      initiationJson: state.initiated.get(publicId) ?? null,
    })),
    statusHistory: [{ toStatus: "DOCUMENT_PENDING", createdAt: iso(-5) }],
    consents: [
      {
        publicId: "c1",
        status: "ACCEPTED",
        purpose: "BGV",
        noticeVersion: "1",
        createdAt: iso(-10),
      },
    ],
    documents: [
      {
        publicId: "doc-1",
        type: "EMPLOYMENT_LETTER",
        status: state.documentStatus,
        currentVersion: 1,
        version: 1,
        versions: [
          {
            version: 1,
            originalName: "letter.pdf",
            contentType: "application/pdf",
            sizeBytes: "100",
            sha256: "x",
            malwareState: "CLEAN",
            createdAt: iso(-6),
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
  const identity = {
    RM: { roles: ["SPOC_RM"], name: "Riya Mehta", departments: undefined },
    DATA_ENTRY: {
      roles: ["DATA_ENTRY"],
      name: "Sara Khan",
      departments: [
        {
          id: "dep-data",
          code: "DATA_ENTRY",
          name: "Data Entry",
          kind: "DATA_ENTRY",
          role: "MEMBER",
        },
      ],
    },
    DATA_ENTRY_LEAD: {
      roles: ["DATA_ENTRY"],
      name: "Ankit Rao",
      departments: [
        {
          id: "dep-data",
          code: "DATA_ENTRY",
          name: "Data Entry",
          kind: "DATA_ENTRY",
          role: "LEAD",
        },
      ],
    },
    TEAM_LEADER: {
      roles: ["VERIFIER"],
      name: "Neeraj Gupta",
      departments: [
        {
          id: "dep-emp",
          code: "EMPLOYMENT",
          name: "Employment",
          kind: "VERIFICATION",
          role: "LEAD",
        },
      ],
    },
    OPS: { roles: ["OPS_MANAGER"], name: "Ananya Rao", departments: undefined },
  }[role];
  const permissions: Record<Role, string[]> = {
    RM: [
      "dashboard:read",
      "notification:read",
      "case:read",
      "document:read",
      "clarification:read",
      "report:read",
    ],
    DATA_ENTRY: [
      "dashboard:read",
      "case:read",
      "document:read",
      "clarification:read",
      "clarification:write",
      "notification:read",
    ],
    DATA_ENTRY_LEAD: [
      "dashboard:read",
      "case:read",
      "document:read",
      "clarification:read",
      "clarification:write",
      "notification:read",
    ],
    TEAM_LEADER: [
      "dashboard:read",
      "case:read",
      "document:read",
      "task:read",
      "task:write",
      "clarification:read",
      "clarification:write",
      "notification:read",
    ],
    OPS: ["*"],
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    requests.push({ method, path, body, query: url.search });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me")
      return reply({
        // The Team Leader is also a member of its department (Neeraj).
        id: role === "TEAM_LEADER" ? "v-neeraj" : "user-1",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: identity.name,
        email: "user@example.invalid",
        roles: identity.roles,
        permissions: permissions[role],
        mustChangePassword: false,
        ...(role === "RM" ? { clientScope: [{ id: "client-horizon", name: "Horizon Tech" }] } : {}),
        ...(identity.departments ? { departments: identity.departments } : {}),
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/tasks/mine/insights")
      return reply({ summary: { active: 0, overdue: 0, blocked: 0 } });
    if (path === "/workflow/departments" && method === "GET") return reply({ items: departments });
    if (path === "/workflow/rm/queue") {
      const bucket = url.searchParams.get("bucket");
      const items =
        bucket === "final_approval"
          ? [finalCase]
          : bucket === "ready"
            ? state.intakeStage === "READY"
              ? [queueCase()]
              : []
            : [queueCase(), finalCase];
      return reply({
        items,
        total: items.length,
        page: 1,
        pageSize: 10,
        counts: {
          needs_data_entry: 0,
          with_data_entry: state.intakeStage === "DATA_ENTRY" ? 1 : 0,
          correction: 0,
          ready: state.intakeStage === "READY" ? 1 : 0,
          in_verification: state.intakeStage === "ROUTED" ? 1 : 0,
          qc: 0,
          final_approval: 1,
        },
        summary: {
          active: items.length,
          overdue: 0,
          dueToday: 1,
          completedThisWeek: 3,
          escalated: 1,
          clients: [{ id: "client-1", name: "Acme Technologies", active: 2, overdue: 0 }],
        },
        generatedAt: iso(0),
      });
    }
    if (path === "/workflow/data-entry/overview")
      return reply({
        scope: "mine",
        canSeeTeam: false,
        kpis: {
          inQueue: 1,
          corrections: 0,
          overdue: 0,
          readyToday: 2,
          readyThisWeek: 9,
          readyThisMonth: 31,
          averageTurnaroundHours: 5.5,
          l1Raised30d: 3,
        },
        trend: Array.from({ length: 14 }, (_, index) => ({
          day: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
          ready: index % 3,
        })),
        pendingByClient: [{ client: "Acme Technologies", count: 1 }],
        recent: [
          {
            caseId: "flow-case-9",
            caseNumber: "SG-2026-0009",
            candidateName: "Meera Iyer",
            clientName: "Acme Technologies",
            dataEntry: null,
            readyAt: iso(-1),
            turnaroundHours: 4,
          },
        ],
        team: [],
        generatedAt: iso(0),
      });
    if (path === "/workflow/data-entry/report/export")
      return route.fulfill({
        contentType: "text/csv",
        body: "Sapling ID,Company\nSG-2026-0009,Acme\n",
      });
    if (path === "/workflow/data-entry/report")
      return reply({
        from: iso(-30),
        to: iso(0),
        total: 1,
        summary: { markedReady: 1, averageTurnaroundHours: 4, l1Raised: 1 },
        rows: [
          {
            caseNumber: "SG-2026-0009",
            candidate: "Meera Iyer",
            client: "Acme Technologies",
            dataEntry: "Niku",
            assignedAt: iso(-1),
            readyAt: iso(-1),
            turnaroundHours: 4,
            stage: "Ready for RM",
            checks: 2,
            checksInitiated: 2,
            l1Raised: 1,
          },
        ],
      });
    if (path === "/workflow/data-entry/queue") {
      const items = ["DATA_ENTRY", "CORRECTION"].includes(state.intakeStage) ? [queueCase()] : [];
      return reply({
        items,
        total: items.length,
        page: 1,
        pageSize: 10,
        counts: {
          mine: state.intakeStage === "DATA_ENTRY" ? 1 : 0,
          correction: state.intakeStage === "CORRECTION" ? 1 : 0,
        },
        generatedAt: iso(0),
      });
    }
    if (path === "/audit-events/exports" && method === "POST") return reply({ logged: true });
    if (path === "/workflow/team/queue") {
      const task = {
        id: "task-1",
        status: state.taskAssignee ? "OPEN" : "UNASSIGNED",
        version: state.taskAssignee ? 2 : 1,
        blockerReason: null,
        createdAt: iso(-2),
        dueAt: iso(20),
        assignee: state.taskAssignee,
        check: {
          id: "chk-emp",
          type: "EMPLOYMENT",
          status: "PENDING",
          routedAt: iso(-2),
          department: { id: "dep-emp", name: "Employment" },
        },
        case: {
          id: "flow-case-1",
          caseNumber: "SG-FLOW-001",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          candidateName: "Kabir Sethi",
          clientName: "Horizon Tech",
          rmName: "Riya Mehta",
        },
      };
      const view = url.searchParams.get("view") ?? "unassigned";
      const items =
        view === "unassigned"
          ? state.taskAssignee
            ? []
            : [task]
          : state.taskAssignee
            ? [task]
            : [];
      return reply({
        items,
        total: items.length,
        page: 1,
        pageSize: 12,
        counts: { unassigned: state.taskAssignee ? 0 : 1, blocked: 0, overdue: 0, total: 1 },
        members: [
          {
            id: "v-neeraj",
            name: "Neeraj Gupta",
            role: "LEAD",
            department: { id: "dep-emp", name: "Employment" },
            openWork: 1,
          },
          {
            id: "v-priya",
            name: "Priya Das",
            role: "MEMBER",
            department: { id: "dep-emp", name: "Employment" },
            openWork: 0,
          },
        ],
        generatedAt: iso(0),
      });
    }
    if (path === "/workflow/tasks/task-1/assignee" && method === "POST") {
      const input = body as { assigneeId: string };
      state.taskAssignee = {
        id: input.assigneeId,
        name: input.assigneeId === "v-priya" ? "Priya Das" : "Neeraj Gupta",
      };
      return reply({ status: "OPEN", version: 2 });
    }
    if (path === "/workflow/cases/flow-case-1/routing" && method === "GET")
      return reply({
        id: "flow-case-1",
        caseNumber: "SG-FLOW-001",
        version: state.version,
        status: state.caseStatus,
        intakeStage: state.intakeStage,
        canRoute: state.intakeStage === "READY",
        departments: [
          {
            id: "dep-emp",
            name: "Employment",
            checkTypes: ["EMPLOYMENT"],
            leads: ["Neeraj Gupta"],
            members: 2,
          },
          { id: "dep-edu", name: "Education", checkTypes: ["EDUCATION"], leads: [], members: 0 },
        ],
        checks: [
          {
            id: "chk-emp",
            type: "EMPLOYMENT",
            status: "PENDING",
            department: null,
            suggestedDepartmentId: "dep-emp",
          },
          {
            id: "chk-edu",
            type: "EDUCATION",
            status: "PENDING",
            department: null,
            suggestedDepartmentId: "dep-edu",
          },
        ],
      });
    if (path === "/workflow/cases/flow-case-1/routing" && method === "POST") {
      state.intakeStage = "ROUTED";
      state.caseStatus = "IN_PROGRESS";
      state.version += 1;
      return reply({ status: "IN_PROGRESS", version: state.version });
    }
    if (path === "/workflow/cases/flow-case-1/ready" && method === "POST") {
      state.intakeStage = "READY";
      state.version += 1;
      return reply({ intakeStage: "READY", version: state.version });
    }
    if (path === "/workflow/cases/flow-case-2/final-review" && method === "GET")
      return reply({
        caseStatus: "MANAGER_REVIEW",
        caseVersion: 7,
        latestQa: {
          id: "qa1",
          decision: "APPROVED",
          notes: "All evidence consistent",
          reviewerName: "QC Team",
          createdAt: iso(-1),
        },
        reviews: [],
      });
    if (path === "/workflow/cases/flow-case-2/final-review" && method === "POST")
      return reply({ caseStatus: "REPORT_PENDING" });
    if (path === "/workflow/initiation-forms")
      return reply({
        forms: {
          EMPLOYMENT: {
            repeatable: true,
            fields: [
              { key: "employerName", label: "Employer name", required: true },
              { key: "tenureFrom", label: "Tenure from", required: true, kind: "date" },
              { key: "tenureTo", label: "Tenure to", required: true, kind: "date" },
              { key: "empCode", label: "Employee code", required: true },
              { key: "hrEmail", label: "HR email", kind: "email" },
            ],
          },
          EDUCATION: {
            repeatable: true,
            fields: [
              { key: "institute", label: "Institute / college", required: true },
              { key: "degree", label: "Degree / course", required: true },
              { key: "passingYear", label: "Passing year", required: true, kind: "year" },
            ],
          },
        },
      });
    if (path.startsWith("/workflow/cases/flow-case-1/checks/") && method === "PUT") {
      const checkId = path.split("/")[5]!;
      state.initiated.set(checkId, JSON.stringify(body));
      return reply({
        id: checkId,
        initiatedAt: iso(0),
        entries: (body as { entries: unknown[] }).entries,
      });
    }
    if (path === "/cases/flow-case-1") return reply(detail());
    if (path === "/cases/flow-case-2")
      return reply({
        ...detail(),
        id: "flow-case-2",
        status: "MANAGER_REVIEW",
        checks: [
          {
            publicId: "chk-x",
            type: "EMPLOYMENT",
            status: "COMPLETED",
            result: "CLEAR",
            riskLevel: "LOW",
            tasks: [],
          },
        ],
      });
    if (path === "/cases/flow-case-1/clarifications" && method === "GET")
      return reply({
        items: state.clarificationOpen
          ? [
              {
                id: "cl-1",
                status: "OPEN",
                subject: "Relieving letter missing",
                level: "L1",
                createdAt: iso(-1),
                messages: [],
              },
            ]
          : [],
      });
    if (path === "/cases/flow-case-1/clarifications" && method === "POST") {
      state.clarificationOpen = true;
      state.intakeStage = "CORRECTION";
      return reply({
        id: "cl-1",
        status: "OPEN",
        subject: "x",
        portalToken: "t",
        tokenExpiresAt: iso(100),
      });
    }
    if (path === "/cases/flow-case-1/evidence-readiness")
      return reply(
        state.documentStatus === "VERIFIED"
          ? { ready: true, issues: [], requiredTypes: ["EMPLOYMENT_LETTER"] }
          : {
              ready: false,
              issues: ["EMPLOYMENT_LETTER: reviewed, unexpired document required"],
              requiredTypes: ["EMPLOYMENT_LETTER"],
            },
      );
    if (path === "/documents/doc-1/review" && method === "PATCH") {
      state.documentStatus = (body as { decision: string }).decision;
      return reply({ id: "doc-1", status: state.documentStatus });
    }
    if (path.endsWith("/activity")) return reply({ items: [], nextCursor: null });
    return route.fulfill({ status: 500, json: { title: `Unexpected ${method} ${path}` } });
  });
  return { requests, state };
}
