import { expect, test } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";

for (const width of [390, 1024, 1440]) {
  test(`client dashboard density fits ${width}px without changing browser zoom`, async ({
    page,
  }) => {
    await clientPagesFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/client-portal");
    await expect(page.getByRole("heading", { name: "Verification overview" })).toBeVisible();
    const desktop = width >= 1024;
    await expect(page.locator("html")).toHaveCSS("zoom", desktop ? "0.9" : "1");
    expect(
      await page
        .locator(".client-portal-shell")
        .evaluate((element) => parseFloat(getComputedStyle(element).minHeight)),
    ).toBeCloseTo(desktop ? 1000 : 900, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    if (width >= 1280) {
      const sidebar = await page.locator(".client-sidebar").boundingBox();
      expect(sidebar!.width).toBeCloseTo(248 * 0.9, 0);
      expect(sidebar!.height).toBeCloseTo(900, 0);
      const header = await page.locator(".client-topbar").boundingBox();
      expect(Math.abs(header!.x - sidebar!.width)).toBeLessThan(1);
      expect(header!.x + header!.width).toBeCloseTo(width, 0);
    }
    await page.getByRole("button", { name: "Open case for Candidate 1", exact: true }).click();
    const caseDialog = page.getByRole("dialog", { name: "Case detail" });
    await expect(caseDialog).toBeVisible();
    const bounds = await caseDialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(-1);
    expect(bounds!.y).toBeGreaterThanOrEqual(-1);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(901);
    expect(bounds!.height).toBeGreaterThan(600);
    await page.keyboard.press("Escape");
    await page.goto("/client-portal/reports?view=custom");
    await page.getByRole("button", { name: /Customise columns/ }).click();
    const columns = page.getByRole("dialog", { name: "Choose & order columns" });
    await expect(columns).toBeVisible();
    await page.screenshot({
      path: `test-results/client-density-panel-${width}.png`,
      animations: "disabled",
    });
    const panel = await columns.boundingBox();
    expect(panel!.x).toBeGreaterThanOrEqual(-1);
    expect(panel!.x + panel!.width).toBeCloseTo(width, 0);
    expect(panel!.height).toBeCloseTo(900, 0);
    await page.keyboard.press("Escape");
    await page.goto("/client-portal");
    await page.screenshot({ path: `test-results/client-density-${width}.png`, fullPage: true });
  });
}
