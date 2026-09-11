import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const requests: string[] = [];
  const unexpected: string[] = [];
  const task = {
    id: "task-test",
    status: "OPEN",
    version: 1,
    dueAt: null,
    instructions: null,
    check: {
      publicId: "check-test",
      type: "EDUCATION",
      status: "ASSIGNED",
      findings: [],
      case: {
        publicId: "case-test",
        caseNumber: "SG-TEST-001",
        priority: "NORMAL",
        subject: { publicId: "candidate", fullName: "Test Candidate" },
        client: { publicId: "client", displayName: "Test Client" },
      },
    },
  };
  const documents = ["EDUCATION_CERTIFICATE", "ADDRESS_PROOF", "PAN", "AADHAAR"].map((type) => ({
    publicId: `doc-${type}`,
    type,
    status: "VERIFIED",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        originalName: `${type.toLowerCase()}.pdf`,
        contentType: "application/pdf",
        sizeBytes: "2000",
        sha256: "a".repeat(64),
        malwareState: "CLEAN",
        createdAt: "2026-09-09T10:00:00Z",
      },
    ],
  }));
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    requests.push(`${route.request().method()} ${path}${url.search}`);
    if (path === "/auth/me")
      return reply({
        id: "verifier-test",
        tenantId: "tenant",
        tenantName: "Test Workspace",
        displayName: "Test Verifier",
        email: "verifier@example.invalid",
        roles: ["VERIFIER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/tasks/mine/insights")
      return reply({
        summary: {
          active: 1,
          open: 1,
          inProgress: 0,
          blocked: 0,
          overdue: 0,
          dueToday: 0,
          dueNext24h: 0,
          completedToday: 0,
          completedThisWeek: 0,
          totalCompleted: 0,
          averageTurnaroundMinutes: 0,
          slaSampleSize: 0,
          slaHitRate: null,
        },
        outcomes: { clear: 0, discrepancy: 0, unableToVerify: 0 },
        daily: [],
      });
    if (path === "/tasks/mine")
      return reply({
        items: [task],
        nextCursor: null,
        summary: { active: 1, overdue: 0, blocked: 0, completedToday: 0 },
      });
    if (path === "/tasks/task-test/context")
      return reply({
        publicId: task.id,
        createdAt: "2026-09-09T10:00:00Z",
        check: {
          ...task.check,
          case: {
            ...task.check.case,
            documents,
            consents: [],
            clarifications: [],
            statusHistory: [],
          },
        },
      });
    unexpected.push(path);
    return reply({ detail: `Unexpected ${path}` }, 501);
  });
  await page.goto("/verifier/queue");
  await page.getByRole("button", { name: /Test Candidate.*SG-TEST-001/ }).click();
  await expect(page.getByRole("navigation", { name: "Selected task workspace" })).toBeVisible();
  return { requests, unexpected, task };
}

for (const width of [1440, 1024, 390]) {
  test(`all verifier navigation options fit without horizontal scrolling at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const setup = await fixture(page);
    const filters = page.locator('[aria-label="Task status"]');
    const tabs = page.getByRole("navigation", { name: "Selected task workspace" });
    for (const group of [filters, tabs]) {
      expect(
        await group.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      const bounds = await group.boundingBox();
      for (const button of await group.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
      }
    }
    await expect(filters.getByRole("button", { name: "Completed", exact: true })).toBeVisible();
    await expect(tabs.getByRole("button", { name: "Activity", exact: true })).toBeVisible();
    await tabs.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Case documents", exact: true })).toBeVisible();
    await expect(page.getByText("Showing 4 of 4 files", { exact: true })).toBeVisible();
    await page.getByLabel("Document type", { exact: true }).selectOption("EDUCATION_CERTIFICATE");
    await expect(page.getByText("Showing 1 of 4 files", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Education Certificate", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pan", exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Preview Education Certificate (opens in a new tab)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Download Education Certificate", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: `test-results/verifier-documents-${width}.png`, fullPage: true });
    expect(setup.unexpected).toEqual([]);
    expect(setup.requests.every((request) => request.startsWith("GET "))).toBe(true);
  });
}

test("document search and status filters still work after the layout change", async ({ page }) => {
  const setup = await fixture(page);
  await page
    .getByRole("navigation", { name: "Selected task workspace" })
    .getByRole("button", { name: "Documents", exact: true })
    .click();
  await page.getByLabel("Search case documents").fill("pan.pdf");
  await expect(page.getByText("Showing 1 of 4 files", { exact: true })).toBeVisible();
  await page.getByLabel("Search case documents").fill("not-a-file");
  await expect(page.getByText("No files match.", { exact: false })).toBeVisible();
  await page
    .locator('[aria-label="Task status"]')
    .getByRole("button", { name: "Completed", exact: true })
    .click();
  await expect
    .poll(() => setup.requests.some((request) => request.includes("status=COMPLETED")))
    .toBe(true);
  expect(setup.unexpected).toEqual([]);
});

test("slow status changes keep controls, selection and document tab mounted", async ({ page }) => {
  const setup = await fixture(page);
  const tabs = page.getByRole("navigation", { name: "Selected task workspace" });
  await tabs.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByText("Showing 4 of 4 files", { exact: true })).toBeVisible();
  const originalSearch = await page.getByLabel("Search assigned checks").elementHandle();
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/tasks/mine?**", async (route) => {
    await waiting;
    await route.fulfill({
      json: {
        items: [{ ...setup.task, status: "COMPLETED" }],
        nextCursor: null,
        summary: { active: 1, overdue: 0, blocked: 0, completedToday: 1 },
      },
    });
  });
  const filters = page.getByRole("group", { name: "Task status" });
  await filters.getByRole("button", { name: "Completed", exact: true }).click();
  try {
    await expect(page.getByText("Updating checks", { exact: true })).toBeVisible();
    await expect(filters.getByRole("button", { name: "Completed", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await originalSearch!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(tabs.getByRole("button", { name: "Documents", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await tabs.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(true);
    await expect(page.getByRole("button", { name: "Next task page" })).toBeDisabled();
    await expect(page.getByText("1 active checks", { exact: true })).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByText("Updating checks", { exact: true })).toHaveCount(0);
  expect(await tabs.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(false);
  await expect(page.getByText("Showing 4 of 4 files", { exact: true })).toBeVisible();
  expect(setup.unexpected).toEqual([]);
});

test("rapid filters ignore a late response and keep the empty queue searchable", async ({
  page,
}) => {
  const setup = await fixture(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let completedRequested = false;
  await page.route("**/api/v1/tasks/mine?**", async (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    if (status === "COMPLETED") {
      completedRequested = true;
      await waiting;
    }
    await route.fulfill({
      json: {
        items: status === "COMPLETED" ? [setup.task] : [],
        nextCursor: null,
        summary: { active: 1, overdue: 0, blocked: 0, completedToday: 0 },
      },
    });
  });
  const filters = page.getByRole("group", { name: "Task status" });
  await filters.getByRole("button", { name: "Completed", exact: true }).click();
  try {
    await expect.poll(() => completedRequested).toBe(true);
    await filters.getByRole("button", { name: "Blocked", exact: true }).click();
    await expect(page.getByText("Queue is clear", { exact: true })).toBeVisible();
  } finally {
    release();
  }
  await expect(filters.getByRole("button", { name: "Blocked", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByLabel("Search assigned checks").fill("no matching candidate");
  await expect(page.getByText("Queue is clear", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test Candidate.*SG-TEST-001/ })).toHaveCount(0);
  expect(setup.unexpected).toEqual([]);
});
