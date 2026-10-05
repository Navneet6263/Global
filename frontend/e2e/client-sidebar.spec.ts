import { expect as baseExpect, test } from "@playwright/test";
import { clientWorkspaceFixture } from "./fixtures/client-workspace-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

for (const size of [
  { width: 1280, height: 600 },
  { width: 1366, height: 768 },
  { width: 1672, height: 1000 },
]) {
  test(`client navigation fits without scrolling at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await clientWorkspaceFixture(page);
    await page.setViewportSize(size);
    await page.goto("/client-portal");
    const sidebar = page.locator(".client-sidebar");
    const nav = sidebar.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "All verifications", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Queries & support", exact: true })).toBeVisible();
    expect(await nav.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await expect(sidebar.getByRole("switch")).toHaveCount(0);
    await expect(sidebar.getByText("Client Tester", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole("button", { name: "Help with this page" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Insights", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Invoices & payments", exact: true })).toBeVisible();
    await nav.getByRole("button", { name: "Reports", exact: true }).click();
    await expect(nav.getByRole("button", { name: "Verifications", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(nav.getByRole("link", { name: "Published reports" })).toBeVisible();
    expect(await nav.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await nav.getByRole("button", { name: "Verifications", exact: true }).click();
    await expect(nav.getByRole("button", { name: "Reports", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const header = page.locator(".client-topbar");
    await expect(header.getByRole("switch", { name: "Learning mode" })).toBeVisible();
    await expect(
      header.getByRole("button", { name: "Account menu for Client Tester" }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      await page
        .locator(".client-table-scroll")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/client-sidebar-${size.width}.png`,
      fullPage: true,
    });
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
  const learning = header.getByRole("switch", { name: "Learning mode" });
  await learning.click();
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await page.reload();
  await expect(learning).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await learning.click();
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
  await header.getByRole("button", { name: "Help with this page" }).click();
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
    await expect(page.getByRole("heading", { name: "Verification overview" })).toBeVisible();
    const header = page.locator(".client-topbar");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await expect(header.getByRole("switch", { name: "Learning mode" })).toBeVisible();
    await header.getByRole("button", { name: /Account menu for Navneet/ }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("dialog", { name: "Client portal navigation" });
    await expect(drawer.getByRole("switch")).toHaveCount(0);
    await drawer.getByRole("link", { name: "In progress", exact: true }).click();
    await expect(page).toHaveURL(/verifications.*status=IN_PROGRESS/);
    await expect(drawer).toHaveCount(0);
    expect(fixture.unexpected).toEqual([]);
    await page.screenshot({
      path: `test-results/client-header-mobile-${width}.png`,
      fullPage: true,
    });
  });
}
