import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const now = Date.now();
// A 1x1 PNG, used as an uploaded screenshot.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

const task = (id: string, name: string, status: string, due: number, extra = {}) => ({
  id,
  status,
  version: 1,
  dueAt: iso(due),
  instructions: null,
  completedAt: status === "COMPLETED" ? iso(-3) : null,
  blockerReason: status === "BLOCKED" ? "Employer HR has not replied" : null,
  check: {
    publicId: `chk-${id}`,
    type: "EMPLOYMENT",
    status: "ASSIGNED",
    department: { name: "Employment", teamType: "EMPLOYMENT" },
    result: status === "COMPLETED" ? "CLEAR" : null,
    findings: [],
    case: {
      publicId: `case-${id}`,
      caseNumber: `SG-2026-${id.toUpperCase()}`,
      priority: "NORMAL",
      subject: { publicId: `sub-${id}`, fullName: name },
      client: { publicId: "client-1", displayName: "Horizon Tech" },
    },
  },
  ...extra,
});

/** A Team Leader (also a verifier) with team work, own work, UTV and annexure rows. */
async function teamLeader(page: Page) {
  const requests: Array<{ method: string; path: string; body?: unknown; search: string }> = [];
  const tasks = [
    task("t1", "Kabir Sethi", "OPEN", 20),
    task("t2", "Meera Iyer", "IN_PROGRESS", -2),
    task("t3", "Rohan Das", "BLOCKED", 30),
  ];
  const done = [task("t9", "Anita Rao", "COMPLETED", -10)];
  const evidence: Array<Record<string, unknown>> = [
    {
      id: "ev-0",
      name: "hr-reply.png",
      contentType: "image/png",
      sizeBytes: 2048,
      caption: "HR email reply",
      uploadedAt: iso(0),
      uploadedBy: "Neeraj Gupta",
    },
  ];
  // What the verifier saved as verified details (step 1 of the check).
  let verifiedEntries: Array<Record<string, string>> = [
    {
      employerName: "Acme Solutions",
      verifierName: "HR Associate",
      method: "Email",
      verificationDate: "2026-10-08",
    },
  ];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    let body: unknown;
    try {
      body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    } catch {
      body = "<file>";
    }
    requests.push({ method, path, body, search: url.search });
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/auth/me")
      return reply({
        id: "v-neeraj",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Neeraj Gupta",
        email: "neeraj@example.invalid",
        roles: ["VERIFIER"],
        permissions: ["*"],
        mustChangePassword: false,
        departments: [
          {
            id: "dep-emp",
            code: "EMPLOYMENT",
            name: "Employment",
            kind: "VERIFICATION",
            role: "LEAD",
          },
        ],
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/tasks/mine/insights")
      return reply({
        summary: {
          active: 3,
          open: 1,
          inProgress: 1,
          blocked: 1,
          overdue: 1,
          dueToday: 1,
          dueNext24h: 2,
          completedToday: 2,
          completedThisWeek: 9,
          totalCompleted: 140,
          averageTurnaroundMinutes: 205,
          slaSampleSize: 9,
          slaHitRate: 89,
        },
        outcomes: { clear: 7, discrepancy: 1, unableToVerify: 1 },
        daily: Array.from({ length: 7 }, (_, i) => ({
          date: iso(-24 * (6 - i)).slice(0, 10),
          completed: [1, 2, 0, 3, 1, 2, 2][i],
        })),
      });
    if (path === "/tasks/mine") {
      const status = url.searchParams.get("status");
      const items =
        status === "COMPLETED"
          ? done
          : status === "BLOCKED"
            ? tasks.filter((t) => t.status === "BLOCKED")
            : tasks;
      return reply({
        items,
        nextCursor: null,
        summary: { active: 3, overdue: 1, blocked: 1, completedToday: 2 },
      });
    }
    if (/^\/tasks\/[^/]+\/context$/.test(path))
      return reply({
        publicId: "t1",
        createdAt: iso(-5),
        check: {
          ...tasks[0]!.check,
          case: {
            ...tasks[0]!.check.case,
            documents: [],
            consents: [],
            clarifications: [],
            statusHistory: [],
          },
        },
      });
    if (path === "/workflow/team/queue" && url.searchParams.get("view") === "review")
      return reply({
        items: [
          {
            id: "team-9",
            status: "COMPLETED",
            version: 4,
            blockerReason: null,
            createdAt: iso(-30),
            dueAt: iso(10),
            assignee: { id: "v-priya", name: "Priya Das" },
            review: {
              result: "CLEAR",
              disposition: "GREEN",
              sourceSummary: "HR confirmed tenure 2021–2024 by email on 7 Oct.",
              riskLevel: null,
              findings: [],
              completedAt: iso(-1),
            },
            check: {
              id: "chk-team-9",
              type: "EMPLOYMENT",
              status: "TL_REVIEW",
              routedAt: iso(-30),
              department: { id: "dep-emp", name: "Employment" },
            },
            case: {
              id: "case-team-9",
              caseNumber: "SG-2026-0050",
              status: "IN_PROGRESS",
              priority: "NORMAL",
              candidateName: "Ritu Sharma",
              clientName: "Horizon Tech",
              rmName: "Riya Mehta",
            },
          },
        ],
        total: 1,
        page: 1,
        pageSize: 12,
        counts: { unassigned: 1, blocked: 0, overdue: 1, total: 3, review: 1 },
        members: [],
        generatedAt: iso(0),
      });
    if (path === "/tasks/team-9/forward")
      return reply({ id: "team-9", status: "COMPLETED", caseToQa: true });
    if (path === "/tasks/t2" && method === "PATCH")
      return reply({ id: "t2", status: "COMPLETED", version: 2, tlReview: true, canForward: true });
    if (path === "/tasks/t2/forward")
      return reply({ id: "t2", status: "COMPLETED", caseToQa: false });
    if (path === "/workflow/team/queue")
      return reply({
        items: [
          {
            id: "team-1",
            status: "UNASSIGNED",
            version: 1,
            blockerReason: null,
            createdAt: iso(-2),
            dueAt: iso(20),
            assignee: null,
            check: {
              id: "chk-team-1",
              type: "EMPLOYMENT",
              status: "PENDING",
              routedAt: iso(-2),
              department: { id: "dep-emp", name: "Employment" },
            },
            case: {
              id: "case-team-1",
              caseNumber: "SG-2026-0042",
              status: "IN_PROGRESS",
              priority: "HIGH",
              candidateName: "Vikram Shah",
              clientName: "Vision India",
              rmName: "Riya Mehta",
            },
          },
          {
            id: "team-2",
            status: "OPEN",
            version: 3,
            blockerReason: null,
            createdAt: iso(-20),
            dueAt: iso(-1),
            assignee: { id: "v-priya", name: "Priya Das" },
            check: {
              id: "chk-team-2",
              type: "EDUCATION",
              status: "ASSIGNED",
              routedAt: iso(-20),
              department: { id: "dep-emp", name: "Employment" },
            },
            case: {
              id: "case-team-2",
              caseNumber: "SG-2026-0040",
              status: "IN_PROGRESS",
              priority: "NORMAL",
              candidateName: "Sana Khan",
              clientName: "Horizon Tech",
              rmName: "Riya Mehta",
            },
          },
        ],
        total: 2,
        page: 1,
        pageSize: 12,
        counts: { unassigned: 1, blocked: 0, overdue: 1, total: 2 },
        members: [
          {
            id: "v-neeraj",
            name: "Neeraj Gupta",
            role: "LEAD",
            department: { id: "dep-emp", name: "Employment" },
            openWork: 3,
          },
          {
            id: "v-priya",
            name: "Priya Das",
            role: "MEMBER",
            department: { id: "dep-emp", name: "Employment" },
            openWork: 5,
          },
          {
            id: "v-arjun",
            name: "Arjun Mehta",
            role: "MEMBER",
            department: { id: "dep-emp", name: "Employment" },
            openWork: 1,
          },
        ],
        generatedAt: iso(0),
      });
    if (path === "/workflow/utv")
      return reply({
        items: [
          {
            checkId: "utv-1",
            checkType: "EMPLOYMENT",
            reason: "Company closed; no HR contact after three attempts",
            closedAt: iso(-30),
            verifier: "Priya Das",
            caseId: "case-u1",
            caseNumber: "SG-2026-0031",
            caseStatus: "IN_PROGRESS",
            candidateName: "Farhan Ali",
            clientName: "Vision India",
            canRework: true,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    if (path === "/workflow/team-annexure")
      return reply({
        period: "month",
        since: iso(-200),
        total: 2,
        colours: { GREEN: 1, RED: 1 },
        items: [
          {
            checkId: "ann-1",
            caseId: "case-a1",
            caseNumber: "SG-2026-0012",
            candidateName: "Anita Rao",
            clientName: "Horizon Tech",
            checkType: "EMPLOYMENT",
            verifier: "Priya Das",
            completedAt: iso(-50),
            status: "Clear",
            colour: "GREEN",
            colourLabel: "Green",
            canSendBack: true,
          },
          {
            checkId: "ann-2",
            caseId: "case-a2",
            caseNumber: "SG-2026-0013",
            candidateName: "Dev Patel",
            clientName: "Vision India",
            checkType: "EDUCATION",
            verifier: "Arjun Mehta",
            completedAt: iso(-70),
            status: "Discrepancy",
            colour: "RED",
            colourLabel: "Red",
            canSendBack: false,
          },
        ],
      });
    if (path === "/workflow/team-annexure/export")
      return route.fulfill({
        contentType: "text/csv",
        body: "Verifier,Sapling ID\r\nPriya Das,SG-2026-0012",
      });
    if (path === "/workflow/team/members" && method === "GET")
      return reply({
        teams: [
          { id: "dep-emp", name: "Employment", kind: "VERIFICATION", memberRole: "VERIFIER" },
        ],
        roles: [
          {
            code: "VERIFIER",
            name: "Verifier",
            permissions: ["task:read", "task:write", "case:read", "document:read"],
          },
        ],
        members: [
          {
            id: "v-neeraj",
            name: "Neeraj Gupta",
            email: "neeraj@example.invalid",
            phone: null,
            status: "ACTIVE",
            version: 1,
            lastLoginAt: iso(-1),
            createdAt: iso(-900),
            teamRole: "LEAD",
            team: { id: "dep-emp", name: "Employment" },
            roles: ["VERIFIER"],
            customAccess: false,
            openWork: 3,
            doneThisWeek: 9,
            isYou: true,
            canManage: false,
          },
          {
            id: "v-priya",
            name: "Priya Das",
            email: "priya@example.invalid",
            phone: "9876543210",
            status: "ACTIVE",
            version: 2,
            lastLoginAt: null,
            createdAt: iso(-300),
            teamRole: "MEMBER",
            team: { id: "dep-emp", name: "Employment" },
            roles: ["VERIFIER"],
            customAccess: true,
            openWork: 5,
            doneThisWeek: 4,
            isYou: false,
            canManage: true,
          },
        ],
        generatedAt: iso(0),
      });
    if (path === "/workflow/team/members" && method === "POST")
      return reply({
        id: "v-new",
        displayName: "Asha Verma",
        email: "asha@example.invalid",
        customAccess: true,
      });
    if (path === "/workflow/team/members/v-priya/reset-password") return reply({ reset: true });
    if (path === "/audit-events/exports") return reply({ logged: true });
    if (path === "/workflow/colour-matrix")
      return reply({
        matrix: {
          EMPLOYMENT: [
            { id: "emp-1", text: "All details verified", colour: "GREEN" },
            {
              id: "emp-5",
              text: "Period of employment differs by more than 1 month",
              colour: "YELLOW",
            },
            { id: "emp-12", text: "Not an employee of the company", colour: "RED" },
            {
              id: "emp-13",
              text: "Terminated for serious integrity issues (fraud, theft, misconduct, harassment, violence) as confirmed by the employer's HR records and the reporting manager in writing",
              colour: "RED",
            },
            {
              id: "emp-21",
              text: "No response / company does not verify as policy",
              colour: "AMBER",
            },
          ],
        },
        colourNames: { GREEN: "Green", YELLOW: "Yellow", AMBER: "Orange", RED: "Red" },
        resultFor: {
          GREEN: "CLEAR",
          YELLOW: "DISCREPANCY",
          RED: "DISCREPANCY",
          AMBER: "UNABLE_TO_VERIFY",
        },
      });
    if (path === "/checks/chk-t2/verified-details" && method === "PUT") {
      verifiedEntries = (
        JSON.parse(request.postData() ?? "{}") as { entries: typeof verifiedEntries }
      ).entries;
      return reply({ checkId: "chk-t2", verifiedAt: iso(0), entries: verifiedEntries });
    }
    if (path === "/checks/chk-t2/verified-details")
      return reply({
        checkId: "chk-t2",
        type: "EMPLOYMENT",
        statusLabel: "In progress",
        lhs: {
          form: {
            repeatable: true,
            fields: [{ key: "employerName", label: "Employer name", required: true }],
          },
          entries: [{ employerName: "Acme Solutions" }],
        },
        rhs: {
          form: {
            repeatable: true,
            fields: [
              {
                key: "employerName",
                label: "Employer name (confirmed)",
                required: true,
                group: "Employment as confirmed",
              },
              {
                key: "verifierName",
                label: "Verified by (name)",
                required: true,
                group: "Referee",
              },
              {
                key: "method",
                label: "Method of verification",
                required: true,
                kind: "select",
                options: ["Email", "Verbal"],
                group: "Method",
              },
              { key: "verificationDate", label: "Verification date", required: true, kind: "date" },
            ],
          },
          entries: verifiedEntries,
          verifiedAt: verifiedEntries.length ? iso(-1) : null,
        },
      });
    if (/^\/checks\/chk-t2\/evidence$/.test(path) && method === "GET")
      return reply({
        checkId: "chk-t2",
        canEdit: true,
        maxFiles: 15,
        maxBytes: 8388608,
        items: evidence,
      });
    if (/^\/checks\/chk-t2\/evidence/.test(path) && method === "POST") {
      const caption = url.searchParams.get("caption");
      evidence.push({
        id: `ev-${evidence.length + 1}`,
        name: "uidai-portal.png",
        contentType: "image/png",
        sizeBytes: 2048,
        caption,
        uploadedAt: iso(0),
        uploadedBy: "Neeraj Gupta",
      });
      return reply(evidence.at(-1));
    }
    if (/^\/checks\/chk-t2\/evidence\/ev-\d+$/.test(path) && method === "GET")
      return route.fulfill({ contentType: "image/png", body: PNG });
    return reply({ items: [], total: 0, nextCursor: null });
  });
  return { requests };
}

const pages = [
  ["/verifier/team", "Team queue"],
  ["/verifier/members", "Team members"],
  ["/verifier/annexure", "Team annexure"],
  ["/verifier", "Verifier overview"],
  ["/verifier/queue", "Active verification queue"],
  ["/verifier/sla", "SLA & priorities"],
  ["/verifier/blockers", "Blockers & clarifications"],
  ["/verifier/utv", "UTV bucket"],
  ["/verifier/history", "Completed checks"],
  ["/verifier/performance", "My performance"],
] as const;

test("every Team Leader page renders in the new layout without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await teamLeader(page);
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/tl-${path.split("/").pop() || "overview"}.png`,
      fullPage: true,
    });
  }
  const nav = page.getByRole("navigation", { name: "verifier navigation" });
  await expect(nav.getByText("My team")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Team queue/ })).toBeVisible();
});

test("a verifier exports completed checks with chosen columns; the export is audited", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/history");
  await expect(page.getByText("Anita Rao")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Export completed checks/ });
  await dialog.getByRole("button", { name: "Result", exact: true }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  const text = await readFile(await (await download).path(), "utf8");
  expect(text.split("\r\n")[0]).toBe(
    '﻿"Sapling ID","Candidate","Company","Check","Status","Due","Result"',
  );
  expect(text).toContain('"SG-2026-T9","Anita Rao","Horizon Tech","Employment","Completed"');
  await expect
    .poll(() => requests.find((r) => r.path === "/audit-events/exports")?.body)
    .toMatchObject({ source: "verifier-history", rows: 1 });
});

test("the team annexure export asks the server for the chosen columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/annexure");
  await expect(page.getByText("Anita Rao")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Export team annexure/ });
  await dialog.getByRole("button", { name: "Move Verifier up" }).click();
  await dialog.getByRole("button", { name: "Remove Colour code" }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  await download;
  const exported = requests.find((r) => r.path === "/workflow/team-annexure/export");
  expect(decodeURIComponent(exported!.search)).toContain(
    "columns=caseNumber,candidate,client,verifier,check,completedAt,status",
  );
});

test("Team Leader pages fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await teamLeader(page);
  for (const path of [
    "/verifier/team",
    "/verifier/utv",
    "/verifier/annexure",
    "/verifier/history",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
  }
  await page.goto("/verifier/team");
  await expect(page.getByText("Vikram Shah")).toBeVisible();
  await page.screenshot({ path: "test-results/tl-team-phone.png", fullPage: true });
});

test("a Team Leader adds a team member with custom access and resets a password", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/members");
  await expect(page.getByText("Priya Das")).toBeVisible();
  await expect(page.getByRole("button", { name: "Actions for Neeraj Gupta" })).toBeDisabled();
  await page.getByRole("button", { name: "Add member" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add team member" });
  await dialog.getByLabel("Full name").fill("Asha Verma");
  await dialog.getByLabel("Work email").fill("asha@example.invalid");
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Customise" }).click();
  await dialog.getByRole("checkbox", { name: /document/i }).uncheck();
  await page.screenshot({ path: "test-results/tl-add-member.png" });
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Custom · 3 of 4 permissions")).toBeVisible();
  await dialog.getByRole("button", { name: "Create login" }).click();
  await expect(page.getByRole("dialog").getByText("asha@example.invalid")).toBeVisible();
  const created = requests.find((r) => r.method === "POST" && r.path === "/workflow/team/members");
  expect(created?.body).toMatchObject({
    displayName: "Asha Verma",
    email: "asha@example.invalid",
    departmentId: "dep-emp",
    permissions: ["task:read", "task:write", "case:read"],
  });
  expect((created?.body as { temporaryPassword: string }).temporaryPassword.length).toBeGreaterThan(
    10,
  );
  await page.getByRole("button", { name: "I have saved it" }).click();
  await page.getByRole("button", { name: "Actions for Priya Das" }).click();
  await page.getByRole("menuitem", { name: "Reset password" }).click();
  await expect
    .poll(() => requests.some((r) => r.path === "/workflow/team/members/v-priya/reset-password"))
    .toBe(true);
});

test("the Active queue lists my checks and opens one in the new layout", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  await teamLeader(page);
  await page.goto("/verifier/queue");
  const list = page.getByRole("region", { name: "Assigned checks" });
  await expect(list.getByRole("button", { name: /Meera Iyer/ })).toBeVisible();
  await list.getByRole("button", { name: /Meera Iyer/ }).click();
  await expect(page.getByRole("heading", { name: "Employment verification" })).toBeVisible();
  await page.screenshot({ path: "test-results/tl-active-queue.png" });
});

test("the Team Leader reviews a member's finished check and forwards it to QA", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/team?view=review");
  await expect(page.getByText("Ritu Sharma")).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Review Employment check/ });
  await expect(dialog.getByText("HR confirmed tenure 2021–2024 by email on 7 Oct.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Send back" })).toBeDisabled();
  await page.screenshot({ path: "test-results/tl-review-dialog.png" });
  await dialog.getByRole("button", { name: "Forward to QA" }).click();
  await expect(page.getByText("Forwarded — the case is now with QA")).toBeVisible();
  expect(requests.some((r) => r.method === "POST" && r.path === "/tasks/team-9/forward")).toBe(
    true,
  );
});

test("a Team Leader finishing its own check is asked to forward it to QA", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/queue?taskId=t2");
  await page
    .getByPlaceholder("Source, verification method, dates and response received")
    .fill("Employer HR confirmed by phone and email.");
  await page.getByRole("button", { name: "Complete check" }).click();
  const prompt = page.getByRole("alertdialog", { name: "Forward this case to QA?" });
  await expect(prompt).toBeVisible();
  await page.screenshot({ path: "test-results/tl-forward-prompt.png" });
  await prompt.getByRole("button", { name: "OK, forward to QA" }).click();
  await expect(
    page.getByText("Forwarded — the case goes to QA when its other checks are forwarded"),
  ).toBeVisible();
  expect(requests.some((r) => r.path === "/tasks/t2/forward")).toBe(true);
});

test("a check cannot be completed until details, proof and summary are done", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await teamLeader(page);
  await page.goto("/verifier/queue?taskId=t2");
  const steps = page.getByRole("navigation", { name: "Steps to complete this check" });
  const complete = page.getByRole("button", { name: "Complete check" });
  await expect(steps.getByText("2 of 4 done")).toBeVisible();
  // Picking a situation alone is not enough: the summary must be written.
  await page.getByLabel("What did you find").selectOption({ label: "All details verified" });
  await expect(complete).toBeDisabled();
  await page
    .getByPlaceholder("Source, verification method, dates and response received")
    .fill("Too short");
  await expect(complete).toBeDisabled();
  await steps.getByRole("button", { name: /Review & complete/ }).click();
  const checklist = page.getByRole("list", { name: "Before you complete" });
  await expect(checklist.getByText("Summary needs at least 20 characters")).toBeVisible();
  await page.screenshot({ path: "test-results/verifier-steps-review.png" });
  await checklist.getByRole("button", { name: "Go to step" }).click();
  await page
    .getByPlaceholder("Source, verification method, dates and response received")
    .fill("HR confirmed tenure and designation by email on 8 Oct.");
  await expect(steps.getByText("3 of 4 done")).toBeVisible();
  await expect(complete).toBeEnabled();
  await page.screenshot({ path: "test-results/verifier-steps-outcome.png" });
  // Long matrix options stay inside the card at laptop and phone widths.
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.locator('[id^="task-steps-"]');
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
      true,
    );
    const select = await page.getByLabel("What did you find").boundingBox();
    const bounds = await card.boundingBox();
    expect(select!.x + select!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
  }
});

test("the verifier adds proof screenshots and picks the finding from the colour matrix", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await teamLeader(page);
  await page.goto("/verifier/queue?taskId=t2");
  const tabs = page.getByRole("navigation", { name: "Selected task workspace" });
  // Employment team: its own process, no vendor tab.
  await expect(tabs.getByRole("button", { name: "Vendor" })).toHaveCount(0);
  const steps = page.getByRole("navigation", { name: "Steps to complete this check" });
  // Details and proof are already in place, so the outcome step opens first.
  await expect(steps.getByRole("button", { name: /Outcome & summary/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page
    .getByLabel("What did you find")
    .selectOption({ label: "Period of employment differs by more than 1 month" });
  await expect(page.getByText(/Colour set to Yellow as per the matrix/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Yellow · Minor discrepancy/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await steps.getByRole("button", { name: /Proof/ }).click();
  const proof = page.getByRole("region", { name: "Proof" });
  await proof.getByLabel("Caption for new proof").fill("Aadhaar verified on UIDAI portal");
  await proof.getByLabel("Add proof files").setInputFiles({
    name: "uidai-portal.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(page.getByText("1 proof file added")).toBeVisible();
  await expect(
    proof.getByRole("list", { name: "Proof files" }).getByText("uidai-portal.png"),
  ).toBeVisible();
  const upload = requests.find((r) => r.method === "POST" && r.path === "/checks/chk-t2/evidence");
  expect(decodeURIComponent(upload!.search)).toContain("caption=Aadhaar verified on UIDAI portal");
  await page.screenshot({ path: "test-results/verifier-proof.png" });
});
