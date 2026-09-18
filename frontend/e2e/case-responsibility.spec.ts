import { expect as baseExpect, test, type Page } from "@playwright/test";
import { operationsInboxFixture } from "./fixtures/operations-inbox-fixture";

const expect = baseExpect.configure({ timeout: 20_000 });
const stamp = "2026-09-14T06:00:00Z";
const person = {
  publicId: "verifier-1",
  displayName: "Test Verifier",
  email: "verifier@example.invalid",
};
const item = {
  id: "inbox-case-1",
  caseNumber: "SG-TEST-1",
  status: "IN_PROGRESS",
  priority: "NORMAL",
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
  subject: { publicId: "subject-1", fullName: "Test Candidate" },
  client: { publicId: "client-1", displayName: "Test Client" },
  checks: [
    {
      publicId: "check-1",
      type: "ADDRESS",
      status: "COMPLETED",
      result: "CLEAR",
      version: 1,
      tasks: [],
    },
    {
      publicId: "check-2",
      type: "IDENTITY",
      status: "ASSIGNED",
      version: 1,
      tasks: [{ publicId: "task-1", status: "OPEN", assignee: person, createdAt: stamp }],
    },
  ],
  documents: [],
  consents: [],
  clarifications: [],
  qaReviews: [],
  reports: [],
  services: [],
  statusHistory: [],
  fieldVisits: [
    {
      publicId: "visit-1",
      status: "COMPLETED",
      version: 1,
      address: "Test visit address",
      geofenceMeters: 150,
      createdAt: stamp,
      completedAt: stamp,
      assignee: { ...person, displayName: "Test Field Executive" },
      _count: { evidence: 1 },
      evidence: [
        { publicId: "photo-1", type: "PHOTO", contentType: "image/png", capturedAt: stamp },
      ],
    },
  ],
};

async function fixture(page: Page, admin: boolean) {
  await operationsInboxFixture(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-user",
        tenantId: "test",
        displayName: "Test User",
        email: "user@example.invalid",
        roles: [admin ? "PLATFORM_ADMIN" : "OPS_MANAGER"],
        permissions: ["*"],
        mustChangePassword: false,
      },
    }),
  );
  await page.route("**/api/v1/cases/inbox-case-1", (route) => route.fulfill({ json: item }));
  await page.route("**/api/v1/cases?*", (route) =>
    route.fulfill({ json: { items: [item], total: 1, page: 1, pageSize: 25 } }),
  );
  await page.route("**/api/v1/clients?*", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  const requests: string[] = [];
  let failure = false;
  let release: (() => void) | undefined;
  let gate: Promise<void> | undefined;
  await page.route("**/api/v1/field-evidence/photo-1/content", async (route) => {
    requests.push(route.request().url());
    await gate;
    if (failure) return route.fulfill({ status: 403, json: { title: "Photo access denied" } });
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  return {
    requests,
    fail: () => {
      failure = true;
    },
    hold: () => {
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release: () => release?.(),
  };
}

for (const admin of [true, false]) {
  test(`${admin ? "Admin" : "Operations"} shows pending owner and field photos without eager image requests`, async ({
    page,
  }) => {
    const data = await fixture(page, admin);
    await page.goto(`${admin ? "/admin" : "/operations"}/cases?caseId=inbox-case-1`);
    const summary = page.getByRole("region", { name: "Current case responsibility" });
    await expect(summary).toContainText("Who needs to act now?");
    await expect(summary).toContainText(person.email);
    await expect(summary).toContainText("identity · not started");
    await expect(summary).toContainText("Field visit approved");
    await expect(summary).toContainText("1/2 checks completed");
    await page.getByRole("tab", { name: "Field photos", exact: true }).click();
    const photos = page.getByRole("region", { name: "Field photos", exact: true });
    await expect(photos).toContainText("Test Field Executive");
    await expect(photos).toContainText("Approved");
    expect(data.requests).toEqual([]);
    const preview = photos.getByRole("button", { name: "Preview field photo 1" });
    const download = photos.getByRole("button", { name: "Download field photo 1" });
    const downloads: string[] = [];
    page.on("download", (event) => downloads.push(event.suggestedFilename()));
    data.hold();
    const popupEvent = page.waitForEvent("popup");
    await preview.click();
    const popup = await popupEvent;
    try {
      await expect(preview).toHaveAttribute("aria-busy", "true");
      await expect(download).toBeDisabled();
      await expect(download).not.toHaveAttribute("aria-busy", "true");
      expect(await popup.evaluate(() => window.opener)).toBeNull();
    } finally {
      data.release();
    }
    await expect(popup).toHaveURL(/^blob:/);
    await expect(preview).toBeEnabled();
    expect(downloads).toEqual([]);
    await popup.close();
    const saved = page.waitForEvent("download");
    await download.click();
    expect((await saved).suggestedFilename()).toBe("field-evidence-photo-1.png");
    expect(data.requests).toHaveLength(2);
  });
}

test("mobile full workspace provides photos; denied access is visible and retry remains available", async ({
  page,
}) => {
  const data = await fixture(page, false);
  data.fail();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cases/inbox-case-1?tab=field-visits");
  const gallery = page.getByRole("region", { name: "Field photos", exact: true });
  await expect(gallery).toBeVisible();
  const download = gallery.getByRole("button", { name: "Download field photo 1" });
  await download.click();
  await expect(gallery.getByRole("alert")).toBeVisible();
  await expect(download).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("admin register shows pending team before opening a case", async ({ page }) => {
  await fixture(page, true);
  await page.goto("/admin/cases");
  await expect(page.getByRole("columnheader", { name: "Pending with" })).toBeVisible();
  await expect(
    page.getByRole("table").getByText("Pending: Verifier", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page
      .getByRole("button", { name: /Test Candidate/ })
      .getByText("Pending: Verifier", { exact: true }),
  ).toBeVisible();
});
