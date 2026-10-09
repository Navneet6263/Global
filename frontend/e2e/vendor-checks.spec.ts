import { expect as baseExpect, test, type Page } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

const now = "2026-10-08T06:00:00Z";
const JOB = "66666666-6666-4666-8666-666666666666";

const addressForm = {
  repeatable: true,
  fields: [
    { key: "respondentName", label: "Respondent name", required: true },
    {
      key: "addressConfirmed",
      label: "Address confirmed",
      required: true,
      kind: "select",
      options: ["Yes", "No"],
    },
    {
      key: "method",
      label: "Method of verification",
      required: true,
      kind: "select",
      options: ["Physical visit", "Vendor visit"],
    },
    { key: "verificationDate", label: "Verification date", required: true, kind: "date" },
  ],
};

function job(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: JOB,
    attempt: 1,
    status,
    checkId: "77777777-7777-4777-8777-777777777777",
    checkType: "ADDRESS",
    caseId: "case-1",
    caseNumber: "SG-VEND-1",
    candidateName: "Aarav Sharma",
    clientName: "Vision India",
    vendor: { id: "vendor-1", name: "Field Co" },
    handler: null,
    assignedBy: "Ananya Rao",
    reviewedBy: null,
    note: "Visit between 10 and 6",
    dueAt: "2026-10-12T12:30:00Z",
    assignedAt: now,
    acceptedAt: null,
    submittedAt: null,
    reviewedAt: null,
    result: null,
    remarks: null,
    declineReason: null,
    reviewNote: null,
    evidenceCount: 0,
    version: 1,
    ageDays: 4,
    ageing: "3-5",
    overdue: false,
    ...extra,
  };
}

/** Vendor workspace: an in-memory job that moves through accept → draft → proof → submit. */
async function vendorFixture(page: Page) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let state = job("ASSIGNED");
  const evidence: unknown[] = [];
  let draft: { entries: unknown[]; result?: string; remarks?: string } = { entries: [] };
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
    calls.push({ method, path, body });
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me")
      return reply({
        id: "vendor-1",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Field Co",
        email: "field@vendor.test",
        roles: ["VENDOR"],
        permissions: ["vendor:review", "notification:read"],
        mustChangePassword: false,
      });
    if (path === "/auth/refresh") return reply({ message: "Unauthorized" }, 401);
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/vendor/checks")
      return reply({
        summary: {
          counts: { [state.status]: 1 },
          ageing: { "0-2": 0, "3-5": 1, "6-10": 0, "10+": 0 },
          overdue: 0,
        },
        items: [state],
      });
    if (path === `/vendor/checks/${JOB}`)
      return reply({
        ...state,
        canDelegate: true,
        team: [{ id: "88888888-8888-4888-8888-888888888888", name: "Ravi (field)" }],
        lhs: {
          form: {
            repeatable: true,
            fields: [
              { key: "address", label: "Address" },
              { key: "city", label: "City" },
            ],
          },
          entries: [{ address: "12 MG Road", city: "Pune" }],
        },
        rhsForm: addressForm,
        results: ["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"],
        submission: draft.entries,
        documents: [
          {
            id: "doc-1",
            type: "ADDRESS_PROOF",
            name: "electricity-bill.pdf",
            contentType: "application/pdf",
          },
        ],
        evidence,
      });
    if (path.endsWith("/accept")) {
      state = job("IN_PROGRESS", { version: 2, acceptedAt: now });
      return reply({ version: 2 });
    }
    if (path.endsWith("/draft")) {
      draft = body as typeof draft;
      state = {
        ...state,
        version: state.version + 1,
        result: draft.result ?? null,
        remarks: draft.remarks ?? null,
      } as typeof state;
      return reply({ version: state.version });
    }
    if (path.endsWith("/evidence") && method === "POST") {
      evidence.push({
        id: "e-1",
        name: "house.jpg",
        contentType: "image/jpeg",
        sizeBytes: 20480,
        uploadedAt: now,
      });
      state = { ...state, evidenceCount: 1 } as typeof state;
      return reply(evidence[0]);
    }
    if (path.endsWith("/submit")) {
      state = job("SUBMITTED", { version: state.version + 1, submittedAt: now, result: "CLEAR" });
      return reply({ version: state.version });
    }
    if (method === "GET") return reply({ items: [], total: 0, counts: {} });
    return reply({ title: `Unmocked ${path}` }, 404);
  });
  return { calls };
}

test("a vendor accepts a check, records what it verified, attaches proof and submits", async ({
  page,
}) => {
  const { calls } = await vendorFixture(page);
  await page.goto("/vendor/checks");
  await expect(page.getByRole("heading", { name: "My checks", level: 1 })).toBeVisible();
  await expect(page.getByText("SG-VEND-1")).toBeVisible();
  await page.getByRole("button", { name: "Open" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Visit between 10 and 6")).toBeVisible();
  await expect(dialog.getByText("12 MG Road")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /electricity-bill\.pdf/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Accept and start" }).click();
  await expect(dialog.getByRole("button", { name: "Submit for review" })).toBeDisabled();
  await dialog.getByLabel("Vendor 1 Respondent name").fill("Neighbour, Mr Joshi");
  await dialog.getByLabel("Vendor 1 Address confirmed").selectOption("Yes");
  await dialog.getByLabel("Vendor 1 Method of verification").selectOption("Physical visit");
  await dialog.getByLabel("Vendor 1 Verification date").fill("2026-10-07");
  await dialog.getByLabel("Result").selectOption("CLEAR");
  await dialog.getByLabel("Remarks").fill("Met the neighbour; house number matches.");
  await dialog.getByLabel("Upload proof").setInputFiles({
    name: "house.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  });
  await expect(dialog.getByRole("button", { name: "house.jpg", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Submit for review" }).click();
  await expect(dialog.getByText(/Waiting for review/)).toBeVisible();
  const draft = calls.find((call) => call.path.endsWith("/draft"))?.body as {
    entries: Array<Record<string, string>>;
    result: string;
  };
  expect(draft.result).toBe("CLEAR");
  expect(draft.entries[0]).toMatchObject({
    respondentName: "Neighbour, Mr Joshi",
    addressConfirmed: "Yes",
  });
  expect(calls.some((call) => call.path.endsWith("/submit"))).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("Operations sees vendor work with chosen columns, exports them and approves a result", async ({
  page,
}) => {
  await operationsOverviewFixture(page);
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let status = "SUBMITTED";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace("/api/v1", "")}${url.search}`;
    const reply = (json: unknown) => route.fulfill({ json });
    const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    if (path.startsWith("/vendor-checks/export")) {
      calls.push({ method: request.method(), path });
      return route.fulfill({
        contentType: "text/csv",
        body: "Sapling ID,Candidate\nSG-VEND-1,Aarav",
      });
    }
    if (path.startsWith("/vendor-checks?") || path === "/vendor-checks") {
      return reply({
        summary: {
          counts: { [status]: 1 },
          ageing: { "0-2": 0, "3-5": 0, "6-10": 0, "10+": 0 },
          overdue: 0,
        },
        items: [job(status, { result: "CLEAR", submittedAt: now, version: 4 })],
      });
    }
    if (path === "/checks/77777777-7777-4777-8777-777777777777/vendor")
      return reply({
        checkId: "77777777-7777-4777-8777-777777777777",
        checkType: "ADDRESS",
        canManage: true,
        assignAs: "OPERATIONS",
        needsApproval: false,
        canAssign: false,
        vendors: [],
        documents: [],
        rhsForm: addressForm,
        attempts: [
          {
            ...job(status, {
              result: "CLEAR",
              remarks: "Met the neighbour",
              submittedAt: now,
              version: 4,
            }),
            canApprove: false,
            canReview: status === "SUBMITTED",
            canCancel: status === "SUBMITTED",
            submission: [{ respondentName: "Neighbour, Mr Joshi", addressConfirmed: "Yes" }],
            evidence: [
              {
                id: "e-1",
                name: "house.jpg",
                contentType: "image/jpeg",
                sizeBytes: 20480,
                uploadedAt: now,
              },
            ],
          },
        ],
      });
    if (path.endsWith("/review")) {
      calls.push({ method: "POST", path, body });
      status = "APPROVED";
      return reply({ id: JOB, status: "APPROVED" });
    }
    return route.fallback();
  });
  await page.goto("/operations/vendor-work");
  await expect(page.getByRole("heading", { name: "Vendor work", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /Columns/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Client" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: "Client" })).toBeVisible();
  await page.getByRole("button", { name: "Export" }).click();
  await expect
    .poll(() => calls.find((call) => call.path.startsWith("/vendor-checks/export"))?.path)
    .toContain("columns=caseNumber%2Ccandidate%2Cclient%2Ccheck");
  await page.getByRole("button", { name: "Open" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Neighbour, Mr Joshi")).toBeVisible();
  await dialog.getByRole("button", { name: "Accept result" }).click();
  await expect
    .poll(() => calls.find((call) => call.path.endsWith("/review"))?.body)
    .toEqual({ decision: "APPROVE", version: 4 });
});

test("the RM approves a Team Leader's vendor request from Vendor work", async ({ page }) => {
  await operationsOverviewFixture(page);
  const calls: Array<{ path: string; body?: unknown }> = [];
  let status = "PENDING_APPROVAL";
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace("/api/v1", "")}${url.search}`;
    const reply = (json: unknown) => route.fulfill({ json });
    const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    const pending = job(status, {
      assignedAs: "TEAM_LEADER",
      assignedBy: "Neeraj Gupta",
      requestReason: "Remote address; the source has not replied in 3 days",
    });
    if (path.startsWith("/vendor-checks?") || path === "/vendor-checks")
      return reply({
        summary: {
          counts: { [status]: 1 },
          ageing: { "0-2": 0, "3-5": 0, "6-10": 0, "10+": 0 },
          overdue: 0,
        },
        items:
          url.searchParams.get("status") && url.searchParams.get("status") !== status
            ? []
            : [pending],
      });
    if (path === "/checks/77777777-7777-4777-8777-777777777777/vendor")
      return reply({
        checkId: "77777777-7777-4777-8777-777777777777",
        checkType: "ADDRESS",
        canManage: true,
        assignAs: "RM",
        needsApproval: false,
        canAssign: false,
        vendors: [],
        documents: [],
        rhsForm: addressForm,
        attempts: [
          {
            ...pending,
            canApprove: status === "PENDING_APPROVAL",
            canReview: false,
            canCancel: true,
            submission: [],
            evidence: [],
          },
        ],
      });
    if (path.endsWith("/approval")) {
      calls.push({ path, body });
      status = "ASSIGNED";
      return reply({ id: JOB, status: "ASSIGNED" });
    }
    return route.fallback();
  });
  await page.goto("/operations/vendor-work?status=PENDING_APPROVAL");
  const tabs = page.getByRole("group", { name: "Filter by status" });
  await expect(tabs.getByRole("button", { name: "Waiting for approval" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Open" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Remote address; the source has not replied in 3 days"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/vendor-rm-approval.png" });
  await dialog.getByRole("button", { name: "Approve & send to vendor" }).click();
  await expect.poll(() => calls[0]?.body).toEqual({ decision: "APPROVE", version: 1 });
});
