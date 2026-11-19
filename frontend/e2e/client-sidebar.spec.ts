import { expect as baseExpect, test } from "@playwright/test";
import { clientWorkspaceFixture } from "./fixtures/client-workspace-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

for (const size of [
  { width: 1280, height: 600 },
  { width: 1366, height: 768 },
  { width: 1672, height: 1000 },
]) {
  // Short screens (1280x600) may scroll the menu itself; larger ones show it all at once.
  const short = size.height < 700;
  test(`client navigation ${short ? "stays usable" : "fits without scrolling"} at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    const fixture = await clientWorkspaceFixture(page);
    await page.setViewportSize(size);
    await page.goto("/client-portal");
    const sidebar = page.locator(".client-sidebar");
    const nav = sidebar.getByRole("navigation", { name: "client-admin navigation" });
    // Flat menu: labelled groups of links, no expandable group buttons.
    await expect(nav.getByRole("button")).toHaveCount(0);
    for (const group of ["Home", "Verifications", "Reports", "Billing", "Help"])
      await expect(nav.getByText(group, { exact: true })).toBeVisible();
    const rows = [
      "Overview",
      "All candidates",
      "Pipeline",
      "Final reports",
      "MIS & Excel",
      "Custom export",
      "Insights",
      "Queries & support",
    ];
    for (const name of rows)
      await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
    // Badged rows: the to-do count and the amount due.
    await expect(nav.getByRole("link", { name: /^Your to-do\b/ })).toContainText("1");
    await expect(nav.getByRole("link", { name: /^Payments\b/ })).toContainText("₹4.5K due");
    // Review submissions appears only when something is waiting.
    await expect(nav.getByRole("link", { name: /Review submissions/ })).toHaveCount(0);
    for (const removed of [
      "All verifications",
      "In progress",
      "Completed",
      "Awaiting release",
      "Invoices & statements",
      "Published reports",
      "Needs your action",
    ])
      await expect(nav.getByRole("link", { name: removed })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Overview", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar.getByRole("switch")).toHaveCount(0);
    await expect(sidebar.getByText("Client Tester", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole("button", { name: "Help with this page" })).toHaveCount(0);
    if (short) {
      // The menu scrolls inside the sidebar; the last row can still be reached and used.
      expect(await nav.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
      const last = nav.getByRole("link", { name: "Queries & support", exact: true });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      const box = await sidebar.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
    } else {
      expect(await nav.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      await expect(
        nav.getByRole("link", { name: "Queries & support", exact: true }),
      ).toBeInViewport();
    }
    const header = page.locator(".client-topbar");
    await expect(header.getByRole("button", { name: "Help menu" })).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Account menu for Client Tester" }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      await page
        .getByRole("region", { name: "Verification cases table" })
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/client-sidebar-${size.width}.png`,
      fullPage: true,
    });
    expect(fixture.unexpected).toEqual([]);
  });
}

test("header profile works with keyboard and preserves real sign out", async ({ page }) => {
  const fixture = await clientWorkspaceFixture(page);
  await page.goto("/client-portal");
  const profile = page.getByRole("button", { name: "Account menu for Client Tester" });
  await profile.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Account security" })).toHaveAttribute(
    "href",
    "/change-password",
  );
  await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(profile).toBeFocused();
  await profile.click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator("html")).toHaveCSS("zoom", "1");
  expect(
    fixture.requests.filter((request) => request.pathname.endsWith("/auth/logout")),
  ).toHaveLength(1);
  expect(fixture.unexpected).toEqual([]);
});

test("learning preference and refresh remain available from the header", async ({ page }) => {
  const fixture = await clientWorkspaceFixture(page);
  await page.goto("/client-portal");
  const header = page.locator(".client-topbar");
  // Help and learning live in one Help menu.
  const openHelp = () => header.getByRole("button", { name: "Help menu" }).click();
  const learning = page.getByRole("switch", { name: "Learning mode" });
  await openHelp();
  await learning.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await page.reload();
  await openHelp();
  await expect(learning).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await learning.click();
  await page.keyboard.press("Escape");
  const before = fixture.requests.filter((url) =>
    url.pathname.endsWith("/dashboards/operations"),
  ).length;
  await header.getByRole("button", { name: "Refresh workspace data" }).click();
  await expect
    .poll(
      () =>
        fixture.requests.filter((url) => url.pathname.endsWith("/dashboards/operations")).length,
    )
    .toBeGreaterThan(before);
  await openHelp();
  await page.getByRole("button", { name: "Help with this page" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

for (const width of [320, 390]) {
  test(`mobile header and navigation remain usable at ${width}px`, async ({ page }) => {
    const fixture = await clientWorkspaceFixture(page, true, {
      displayName: "Navneet Kumar Long Account Name",
      clientName: "North Eastern Education and Technical Training Organisation",
    });
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/client-portal");
    await expect(
      page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening), Navneet$/ }),
    ).toBeVisible();
    const header = page.locator(".client-topbar");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(header.getByRole("button", { name: "Help menu" })).toBeVisible();
    await header.getByRole("button", { name: /Account menu for Navneet/ }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Client portal navigation" });
    await expect(drawer.getByRole("switch")).toHaveCount(0);
    await expect(
      drawer.getByRole("navigation", { name: "client-admin navigation" }).getByRole("button"),
    ).toHaveCount(0);
    await drawer.getByRole("link", { name: "All candidates", exact: true }).click();
    await expect(page).toHaveURL(/\/client-portal\/verifications$/);
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "All candidates", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(fixture.unexpected).toEqual([]);
    await page.screenshot({
      path: `test-results/client-header-mobile-${width}.png`,
      fullPage: true,
    });
  });
}

test("the sidebar collapses to icons, remembers it and expands again", async ({ page }) => {
  const fixture = await clientWorkspaceFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/client-portal");
  const sidebar = page.locator(".client-sidebar");
  const wide = (await sidebar.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
  // Icons keep their names for screen readers and hover, and still navigate.
  const nav = page.getByRole("navigation", { name: "client-admin navigation" });
  await expect(nav.getByRole("link", { name: "Pipeline", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  await nav.getByRole("link", { name: "All candidates", exact: true }).click();
  await expect(page).toHaveURL(/\/client-portal\/verifications/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeCloseTo(wide, 0);
  expect(fixture.unexpected).toEqual([]);
});
