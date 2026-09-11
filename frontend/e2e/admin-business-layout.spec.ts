import { expect as baseExpect, test, type Page } from "@playwright/test";
import { operationsInboxFixture } from "./fixtures/operations-inbox-fixture";

const expect = baseExpect.configure({ timeout: 20_000 });

async function fixture(page: Page, empty = false) {
  const { requests } = await operationsInboxFixture(page);
  await page.route("**/api/v1/crm/overview", (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        trend: [],
        followUps: [],
        stages: [],
        activities: [],
        summary: {
          openValue: 0,
          weightedValue: 0,
          wonValue: 0,
          winRate: 0,
          overdueFollowUps: 0,
          activeOwners: 0,
          pendingFollowUps: 0,
          unassignedOpportunities: 0,
        },
      },
    }),
  );
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-admin",
        tenantId: "test",
        displayName: "Test Admin",
        email: "admin@example.invalid",
        roles: ["PLATFORM_ADMIN"],
        permissions: ["*"],
        mustChangePassword: false,
      },
    }),
  );
  await page.route("**/api/v1/dashboards/executive?*", (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        performance: { averageTatHours: 12, slaPercentage: 95 },
        performanceTrend: [],
        attentionQueue: [],
        trend: [],
        businessHealth: {
          finance: empty
            ? { billed: 0, collected: 0, outstanding: 0, overdue: 0 }
            : { billed: 100000, collected: 60000, outstanding: 30000, overdue: 5000 },
        },
        outcomeMix: empty ? {} : { CLEAR: 6, DISCREPANCY: 1, UNABLE_TO_VERIFY: 1, PENDING: 2 },
      },
    }),
  );
  await page.route("**/api/v1/dashboards/exceptions", (route) =>
    route.fulfill({
      json: {
        summary: { clientActions: 0, critical: 0, clarifications: 0 },
      },
    }),
  );
  await page.route("**/api/v1/clients?*", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("**/api/v1/cases?*", (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 25 } }),
  );
  return requests;
}

test("admin replaces service health with real-value billing and result graphs", async ({
  page,
}) => {
  const requests = await fixture(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  const revenue = page.getByRole("region", { name: "Revenue and collections" });
  await expect(revenue).toBeVisible();
  await expect(revenue.getByText("₹60,000", { exact: true })).toHaveCount(2);
  await expect(revenue.getByText("₹30,000", { exact: true })).toBeVisible();
  const results = page.getByRole("region", { name: "Verification results" });
  await expect(results.getByText("2 pending", { exact: true })).toBeVisible();
  await expect(results.getByText("60%", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Platform health" })).toHaveCount(0);
  expect(requests.some((url) => url.pathname.includes("/health/"))).toBe(false);
  await expect(revenue.getByRole("link", { name: "Finance" })).toHaveAttribute(
    "href",
    "/admin/finance",
  );
  await revenue.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/admin-business-desktop.png" });
});

test("zero data and mobile layout do not invent results or revenue", async ({ page }) => {
  await fixture(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByText("No verification checks in this period.")).toBeVisible();
  await expect(page.getByText(/No billing activity in this period/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1440, 390]) {
  test(`Case 360 tabs stay inside their strip and Reports opens at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/cases?caseId=inbox-case-1");
    const tabs = page.getByRole("tablist", { name: "Case sections" });
    await expect(tabs).toBeVisible();
    const strip = await tabs.boundingBox();
    for (const tab of await tabs.getByRole("tab").all()) {
      const bounds = await tab.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(strip!.x);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(strip!.y + strip!.height + 1);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(strip!.x + strip!.width + 1);
    }
    await tabs.getByRole("tab", { name: "Reports", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText("No report published yet");
    await tabs.screenshot({ path: `test-results/case-tabs-${width}.png` });
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  });
}
