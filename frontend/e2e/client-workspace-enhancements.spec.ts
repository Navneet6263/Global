import { expect, test } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";
import { caseInitiationFixture } from "./fixtures/case-initiation-browser-fixture";

test("verification columns are selectable, persisted and reset without changing case data", async ({
  page,
}) => {
  await clientPagesFixture(page);
  await page.goto("/client-portal");
  await expect(page.locator(".client-case-table tbody tr")).toHaveCount(6);
  await page.getByRole("button", { name: /^Columns/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Checks", exact: true }).click();
  await page.getByRole("menuitemcheckbox", { name: "Package", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("columnheader", { name: "Checks", exact: true })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Package", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Candidate / Case" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("columnheader", { name: "Package", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Columns/ }).click();
  await page.getByRole("menuitem", { name: "Restore default columns" }).click();
  await expect(page.getByRole("columnheader", { name: "Checks", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Package", exact: true })).toHaveCount(0);
});

test("workspace search discovers features and routes candidate queries", async ({ page }) => {
  await clientPagesFixture(page);
  await page.goto("/client-portal");
  const search = page.getByRole("combobox", { name: "Search features or cases" });
  await search.fill("export");
  await page.getByRole("option", { name: /Customise export/ }).click();
  await expect(page).toHaveURL(/reports\?view=custom/);
  await expect(page.getByRole("heading", { name: "Build your own report" })).toBeVisible();
  await search.fill("Candidate 1");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/verifications\?q=Candidate/);
  await expect(
    page.getByRole("searchbox", { name: "Search candidate or case number" }),
  ).toHaveValue("Candidate 1");
});

for (const width of [390, 1440]) {
  test(`case workspace tabs, escape and layout work at ${width}px`, async ({ page }) => {
    await clientPagesFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/client-portal");
    await page.getByRole("button", { name: "Open case for Candidate 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Case detail" });
    await expect(dialog.getByRole("tab", { name: /Checks/ })).toBeVisible();
    await dialog.getByRole("tab", { name: /Documents/ }).click();
    await expect(dialog.getByRole("tab", { name: /Documents/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog.getByRole("tab", { name: "Timeline" }).click();
    await expect(dialog.getByRole("tab", { name: "Timeline" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog.getByRole("tab", { name: "Requests" }).click();
    await expect(dialog.getByText("No clarification is pending", { exact: true })).toBeVisible();
    await dialog.getByRole("tab", { name: /Checks/ }).click();
    await page.screenshot({
      path: `test-results/client-case-improved-${width}.png`,
      animations: "disabled",
    });
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(901);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/caseId=/);
  });
}

test("new verification submits selected checks, shows tax and emails one candidate link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await caseInitiationFixture(page);
  const dialog = page.getByRole("dialog", { name: "Initiate a verification case" });
  await dialog.getByLabel("Candidate name", { exact: true }).fill("Layout Test Candidate");
  await dialog.getByLabel("Email", { exact: true }).fill("candidate@example.invalid");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: /Standard BGV/ }).click();
  await dialog
    .getByRole("checkbox", { name: "Standard BGV: Address (physical)", exact: true })
    .uncheck();
  await expect(dialog.getByText("1 of 2 checks selected")).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Price estimate" })).toContainText("₹2,950.00");
  await page.screenshot({ path: "test-results/client-intake-checks.png", animations: "disabled" });
  await dialog
    .getByRole("checkbox", { name: "Standard BGV: Identity (Aadhaar / PAN)", exact: true })
    .uncheck();
  await expect(dialog.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: "Standard BGV: Identity (Aadhaar / PAN)", exact: true })
    .check();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByText("One secure link for the candidate")).toBeVisible();
  await page.screenshot({ path: "test-results/client-intake-review.png", animations: "disabled" });
  await dialog.getByRole("button", { name: "Initiate case", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Candidate link", exact: true })).toHaveValue(
    /#token=/,
  );
  expect(fixture.payloads[0]?.body).toMatchObject({
    services: [{ servicePackageId: "package-test", selectedChecks: ["IDENTITY"] }],
  });
  expect(fixture.payloads).toHaveLength(1);
  expect(fixture.unexpected).toEqual([]);
});
