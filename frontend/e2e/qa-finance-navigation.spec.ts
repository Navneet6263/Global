import { expect as baseExpect, test } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";
import { financeBrowserFixture } from "./fixtures/finance-browser-fixture";

const expect = baseExpect.configure({ timeout: 20_000 });

test("QA sidebar opens focused pages and overview does not fetch case evidence", async ({
  page,
}) => {
  const fixture = await qaBrowserFixture(page);
  await page.goto("/qa-review/overview");
  await expect(page.getByRole("heading", { name: "QA overview", exact: true })).toBeVisible();
  await expect(page.getByText("2 awaiting review", { exact: true })).toBeVisible();
  expect(fixture.details).toEqual([]);
  const nav = page.getByRole("navigation", { name: "qa-reviewer navigation" });
  await expect(nav.getByRole("link", { name: "QA overview", exact: true })).toHaveAttribute(
    "data-status",
    "active",
  );
  await expect(nav.locator('a[data-status="active"]')).toHaveCount(1);
  await nav.getByRole("link", { name: "My reviews", exact: true }).click();
  await expect(page).toHaveURL(/\/qa-review\/mine$/);
  await expect(page.getByRole("heading", { name: "My reviews", exact: true })).toBeVisible();
  await expect(nav.locator('a[data-status="active"]')).toHaveCount(1);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "QA overview", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/qa-overview-updated.png", fullPage: true });
  expect(fixture.unexpected).toEqual([]);
});

test("QA slow search keeps controls mounted and blocks old-case actions", async ({ page }) => {
  const fixture = await qaBrowserFixture(page);
  await page.goto("/qa-review");
  await expect(page.getByRole("heading", { name: "Check results and findings" })).toBeVisible();
  const search = page.getByLabel("Search QA queue");
  const node = await search.elementHandle();
  let release!: () => void;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/qa/register?**", async (route) => {
    await hold;
    await route.fallback();
  });
  await search.fill("QA");
  try {
    await expect(page.getByText("Updating cases", { exact: true })).toBeVisible();
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
    const claim = page.getByRole("button", { name: "Claim case", exact: true });
    expect(await claim.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(true);
  } finally {
    release();
  }
  await expect(page.getByText("Updating cases", { exact: true })).toHaveCount(0);
  expect(fixture.unexpected).toEqual([]);
});

test("Finance pages load only their own data and keep invoice actions available", async ({
  page,
}) => {
  const fixture = await financeBrowserFixture(page);
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: "Finance overview", exact: true })).toBeVisible();
  await expect(page.getByText("1 invoices in register", { exact: true })).toBeVisible();
  expect(fixture.requests.some((entry) => entry.includes("/finance/invoices"))).toBe(false);
  await page.screenshot({ path: "test-results/finance-overview-updated.png", fullPage: true });
  const nav = page.getByRole("navigation", { name: "finance navigation" });
  await nav.getByRole("link", { name: "Invoices", exact: true }).click();
  await page.getByRole("button", { name: "View INV-TEST-001", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Payment reconciliation");
  await expect(page.getByRole("button", { name: "Record payment", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close invoice", exact: true }).last().click();
  await nav.getByRole("link", { name: "Collections", exact: true }).click();
  await expect(page.getByLabel("Filter invoices by status")).toHaveValue("OVERDUE");
  await nav.getByRole("link", { name: "Ready for billing", exact: true }).click();
  await expect(page.getByText("No prepared reports are awaiting billing.")).toBeVisible();
  await nav.getByRole("link", { name: "Credit control", exact: true }).click();
  await expect(page.getByLabel("Search credit-control clients")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage credit" })).toHaveCount(0);
  await nav.getByRole("link", { name: "Statements", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Monthly client ledger" })).toBeVisible();
  await expect(nav.locator('a[data-status="active"]')).toHaveCount(1);
  expect(fixture.requests.every((request) => request.startsWith("GET "))).toBe(true);
  expect(fixture.unexpected).toEqual([]);
});

test("Finance slow search does not remove filters or enable stale invoices", async ({ page }) => {
  const fixture = await financeBrowserFixture(page);
  await page.goto("/finance/invoices");
  await expect(page.getByRole("button", { name: "View INV-TEST-001" })).toBeVisible();
  const search = page.getByLabel("Search invoices", { exact: true });
  const node = await search.elementHandle();
  fixture.pauseInvoices();
  await search.fill("no such invoice");
  try {
    await expect(page.getByText("Updating invoices", { exact: true })).toBeVisible();
    expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
    expect(
      await page
        .getByRole("button", { name: "View INV-TEST-001" })
        .evaluate((element) => Boolean(element.closest("[inert]"))),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Export full ledger", exact: true }),
    ).toBeDisabled();
  } finally {
    fixture.resumeInvoices();
  }
  await expect(page.getByText("No matching invoice", { exact: true })).toBeVisible();
  await expect(search).toHaveValue("no such invoice");
  expect(fixture.unexpected).toEqual([]);
});

for (const role of ["qa", "finance"] as const) {
  test(`${role} mobile sidebar opens a focused page without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture =
      role === "qa" ? await qaBrowserFixture(page) : await financeBrowserFixture(page);
    await page.goto(role === "qa" ? "/qa-review/overview" : "/finance");
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    const label = role === "qa" ? "Decision history" : "Statements";
    await page.getByRole("link", { name: label, exact: true }).filter({ visible: true }).click();
    await expect(
      page.getByRole("heading", { name: role === "qa" ? label : "Client statements", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/${role}-mobile-navigation.png`, fullPage: true });
    expect(fixture.unexpected).toEqual([]);
  });
}

test("Finance read-only access hides invoice creation and billing preparation", async ({
  page,
}) => {
  const fixture = await financeBrowserFixture(page, false);
  await page.goto("/finance/invoices");
  await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Issue invoice", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ready for billing", exact: true })).toHaveCount(0);
  await page.goto("/finance/billing");
  await expect(page.getByText("Preparing an invoice requires Finance write access.")).toBeVisible();
  expect(fixture.requests.some((entry) => entry.includes("/finance/billing-ready"))).toBe(false);
  expect(fixture.unexpected).toEqual([]);
});

test("new QA pages keep the role boundary on direct navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const fixture = await financeBrowserFixture(page);
  await page.goto("/qa-review/history");
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByRole("heading", { name: "Finance overview", exact: true })).toBeVisible();
  expect(fixture.requests.some((request) => request.includes("/qa/"))).toBe(false);
  expect(fixture.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("an invoice API error is not presented as an empty successful register", async ({ page }) => {
  await financeBrowserFixture(page);
  await page.route("**/api/v1/finance/invoices?**", (route) =>
    route.fulfill({
      status: 400,
      json: { title: "Invoice list unavailable", detail: "Test unavailable response" },
    }),
  );
  await page.goto("/finance/invoices");
  await expect(
    page.getByText("Invoice list unavailable. Retry using the message above."),
  ).toBeVisible();
  await expect(page.getByLabel("Search invoices")).toBeVisible();
  await expect(page.getByText("No matching invoice", { exact: true })).toHaveCount(0);
});
