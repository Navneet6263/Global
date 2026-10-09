import { expect as baseExpect, test } from "@playwright/test";
import { spocFixture } from "./fixtures/spoc-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("RM sidebar shows the work steps and what needs attention, with counts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await spocFixture(page);
  await page.goto("/spoc-rm/clients");
  const nav = page.getByRole("navigation", { name: "spoc-rm navigation" });
  await expect(nav.getByText("Needs attention")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Escalations\s*2/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Overdue cases\s*4/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Final reviews\s*3/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My clients" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.screenshot({ path: "test-results/rm-clients.png", fullPage: true });
});

for (const [path, name] of [
  ["/spoc-rm", "rm-monitoring"],
  ["/spoc-rm/records", "rm-records"],
] as const) {
  test(`${path} renders cleanly`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await spocFixture(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  });
}
