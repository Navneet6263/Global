import { expect as baseExpect, test } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";
import { financeBrowserFixture } from "./fixtures/finance-browser-fixture";
import { dispatchFixture } from "./fixtures/dispatch-fixture";

const expect = baseExpect.configure({ timeout: 20_000 });
for (const width of [1440, 390]) {
  for (const role of ["qa", "finance", "operations"] as const) {
    test(`${role} header is compact and keeps controls at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const fixture =
        role === "qa"
          ? await qaBrowserFixture(page)
          : role === "finance"
            ? await financeBrowserFixture(page)
            : await dispatchFixture(page);
      await page.goto(
        role === "qa"
          ? "/qa-review"
          : role === "finance"
            ? "/finance/invoices"
            : "/operations/cases",
      );
      const header = page.locator("[data-workspace-heading]");
      const title = header.getByRole("heading", { level: 1 });
      await expect(title).toBeVisible();
      const bounds = await header.boundingBox();
      expect(bounds!.height).toBeLessThanOrEqual(width === 1440 ? 44 : 80);
      const descriptionId = await title.getAttribute("aria-describedby");
      expect(descriptionId).toBeTruthy();
      const description = page.locator(`[id="${descriptionId}"]`);
      await expect(description).toHaveClass("sr-only");
      expect(await description.textContent()).toBeTruthy();
      expect(
        await title.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
      ).toBeLessThanOrEqual(20);
      if (role === "qa") {
        await expect(header.getByText("2 awaiting review", { exact: true })).toBeVisible();
        await expect(page.getByRole("checkbox", { name: "Available to claim only" })).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Check results and findings" }),
        ).toBeVisible();
        await expect(page.getByRole("region", { name: "Live workspace summary" })).toHaveCount(0);
        if (width === 1440) {
          const review = await page
            .getByRole("region", { name: "Selected case review", exact: true })
            .boundingBox();
          expect(review!.y - (bounds!.y + bounds!.height)).toBeLessThanOrEqual(28);
        }
      } else if (role === "finance") {
        await expect(
          header.getByRole("button", { name: "Issue invoice", exact: true }),
        ).toBeVisible();
        await page.getByRole("button", { name: "View INV-TEST-001" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.getByRole("button", { name: "Close invoice", exact: true }).last().click();
      } else {
        await expect(
          page
            .getByRole("checkbox", { name: "Select DISPATCH-1", exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `test-results/compact-${role}-${width}.png`, fullPage: true });
      expect(fixture.unexpected).toEqual([]);
    });
  }
}
