import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";
async function contents(download: import("@playwright/test").Download) {
  return readFile((await download.path())!, "utf8");
}
test("custom exports select and reorder exact columns across all loaded cases", async ({
  page,
}) => {
  await clientPagesFixture(page);
  await page.goto("/client-portal/reports?view=custom");
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await expect(page.getByText("23 matching rows · 5 columns")).toBeVisible();
  await page.getByRole("button", { name: /Customise columns/ }).click();
  await page.getByRole("checkbox", { name: "Package", exact: true }).uncheck();
  await page.getByRole("button", { name: "Move Candidate up", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV", exact: true }).click();
  const csv = await contents(await download);
  expect(csv.split("\r\n")[0]).toBe('\uFEFF"Candidate","Case number","Status","Created at (IST)"');
  expect(csv).toContain("Candidate 23");
  expect(csv.split("\r\n")).toHaveLength(24);
  expect(csv).not.toContain("Package");
  await page.getByLabel("Search", { exact: true }).fill("Candidate 23");
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await expect(page.getByText("1 matching rows · 4 columns")).toBeVisible();
});
test("expense-only exports respect status, keep currency and aggregate real invoice amounts", async ({
  page,
}) => {
  await clientPagesFixture(page);
  await page.goto("/client-portal/reports?view=custom");
  await page.getByRole("combobox", { name: "Report type", exact: true }).selectOption("spend");
  await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("OVERDUE");
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await expect(page.getByText("1 matching rows · 5 columns")).toBeVisible();
  await page.getByRole("button", { name: /Customise columns/ }).click();
  await expect(page.getByRole("checkbox", { name: "Currency", exact: true })).toBeDisabled();
  for (const label of ["Invoice count", "Payments recorded", "Outstanding balance"])
    await page.getByRole("checkbox", { name: label, exact: true }).uncheck();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect(await contents(await download)).toBe('\uFEFF"Currency","Total billed"\r\n"INR","14160"');
});
test("failed export cannot download a partial file and can retry", async ({ page }) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/reports?view=custom");
  await page.getByRole("combobox", { name: "Report type", exact: true }).selectOption("invoices");
  fixture.fail("/client-finance/invoices");
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Test service unavailable" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  fixture.fail("");
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await expect(page.getByText("23 matching rows · 6 columns")).toBeVisible();
});
test("cancelled preparation does not restore stale download controls", async ({ page }) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/reports?view=custom");
  await page.getByRole("combobox", { name: "Report type", exact: true }).selectOption("invoices");
  fixture.delay(1000);
  await page.getByRole("button", { name: "Apply filters & preview" }).click();
  await page.getByRole("button", { name: "Cancel preparation" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Preparation cancelled" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply filters & preview" })).toBeEnabled();
});
for (const width of [390, 1440])
  test(`custom report builder fits ${width}px`, async ({ page }) => {
    await clientPagesFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/client-portal/reports?view=custom");
    await page.getByRole("button", { name: "Apply filters & preview" }).click();
    await expect(page.getByText("23 matching rows · 5 columns")).toBeVisible();
    await expect(page.getByRole("group", { name: "Report filters" })).toHaveCSS("display", "grid");
    const borderPixels = await page
      .getByRole("searchbox", { name: "Search", exact: true })
      .evaluate(
        (element) =>
          parseFloat(getComputedStyle(element).borderTopWidth) *
          Number(getComputedStyle(document.documentElement).zoom),
      );
    expect(borderPixels).toBeCloseTo(1, 2);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/client-export-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: /Customise columns/ }).click();
    const panel = page.getByRole("dialog", { name: "Choose & order columns" });
    await expect(panel).toBeVisible();
    expect(await panel.evaluate((el) => el.getBoundingClientRect().width <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `test-results/client-export-columns-${width}.png`,
      animations: "disabled",
    });
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Customise columns/ })).toBeFocused();
  });
