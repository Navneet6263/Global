import { expect as baseExpect, test } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("reports preserve search, pagination, access controls and per-row download feedback", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/reports");
  await expect(page.getByText("Report Candidate 0", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download report for Report Candidate 2", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Verify", exact: true }).first()).toHaveAttribute(
    "href",
    "/reports/verify/AUTH-0",
  );
  fixture.delay(700);
  const downloaded = page.waitForEvent("download");
  const first = page.getByRole("button", {
    name: "Download report for Report Candidate 0",
    exact: true,
  });
  await first.click();
  await expect(first).toHaveAttribute("aria-busy", "true");
  await expect(
    page.getByRole("button", { name: "Download report for Report Candidate 1", exact: true }),
  ).toBeEnabled();
  await downloaded;
  fixture.delay(0);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Report Candidate 8", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search reports" }).fill("Report Candidate 21");
  await page
    .locator(".client-register-search")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.getByText("Report Candidate 21", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(page.getByRole("searchbox", { name: "Search reports" })).toHaveValue(
    "Report Candidate 21",
  );
  expect(fixture.requests.some((r) => r.query.includes("cursor=8"))).toBe(true);
  expect(fixture.unexpected).toEqual([]);
});

test("report errors retain search and recover without reporting a false empty library", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  fixture.fail("/reports");
  await page.goto("/client-portal/reports");
  await expect(page.getByRole("searchbox", { name: "Search reports" })).toBeVisible();
  await expect(page.getByText("Test service unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("No published reports found", { exact: true })).toHaveCount(0);
  fixture.fail("");
  await page.getByRole("button", { name: /retry|try again/i }).click();
  await expect(page.getByText("Report Candidate 0", { exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search reports" }).fill("no-match");
  await page
    .locator(".client-register-search")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.getByText("No published reports found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByText("Report Candidate 0", { exact: true })).toBeVisible();
});

test("invoices expose balances and credits with working filters, pages and statement export", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/billing");
  await expect(page.getByRole("button", { name: "Download INV-0", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Monthly statement" })).toHaveCount(0);
  await page.goto("/client-portal/reports?view=invoices");
  await page.getByRole("button", { name: "Details for INV-0", exact: true }).click();
  await expect(page.getByText("Credit applied", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("INV-8", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overdue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  await expect(page.getByText("INV-1", { exact: true })).toHaveCount(0);
  fixture.delay(700);
  const downloaded = page.waitForEvent("download");
  const first = page.getByRole("button", { name: "Download INV-0", exact: true });
  await first.click();
  await expect(first).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("button", { name: "Download INV-2", exact: true })).toBeEnabled();
  await downloaded;
  fixture.delay(0);
  await page.getByRole("button", { name: "Monthly statement" }).click();
  const statement = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download statement CSV" }).click();
  await statement;
  expect(fixture.requests.some((r) => r.path === "/client-finance/statement")).toBe(true);
  expect(fixture.unexpected).toEqual([]);
});

test("actions show more than six requests, filter by type and close the case with browser Back", async ({
  page,
}) => {
  await clientPagesFixture(page);
  await page.goto("/client-portal/actions");
  await expect(page.getByText("Confirm education 0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Confirm education 8", { exact: true })).toBeVisible();
  await page
    .getByRole("group", { name: "Action type" })
    .getByRole("button", { name: /Documents/ })
    .click();
  await expect(page.getByText("EDUCATION needs replacement", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review & respond" }).click();
  await expect(page.getByRole("dialog", { name: "Case detail" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Case detail" })).toHaveCount(0);
});

test("insights switch between live flow, quality and searchable branch comparisons", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/analytics");
  await expect(page.getByRole("heading", { name: "Stage ageing" })).toBeVisible();
  await page.getByRole("button", { name: "Quality & rework" }).click();
  await expect(page.getByRole("heading", { name: "Document quality", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage ageing" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quality decisions" })).toBeVisible();
  await page.getByRole("button", { name: "Branch comparison", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delivery branch comparison" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search delivery branches" }).fill("unknown");
  await page
    .locator(".client-register-search")
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page.getByText("No matching branch data", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Flow & outcomes" }).click();
  await page.getByRole("link", { name: "View cases", exact: false }).click();
  await expect(page).toHaveURL(/status=DOCUMENT_PENDING/);
  expect(fixture.unexpected).toEqual([]);
});

test("support is a real sidebar page with pagination, reply history and scoped request submission", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal");
  await page.locator(".client-sidebar").getByRole("link", { name: "Queries & support" }).click();
  await expect(page).toHaveURL(/\/client-portal\/support$/);
  await expect(
    page.getByText("Please upload the clearer original.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(
    page.getByRole("heading", { name: "Upload question 10", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page.getByLabel("What is it about?").fill("Upload needs checking");
  await page.getByLabel("Case number (optional)").fill("SG-TEST-1");
  await page
    .getByLabel("Describe the problem")
    .fill("The document is readable but the upload was interrupted.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Support request sent", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Upload needs checking", exact: true }),
  ).toBeVisible();
  expect(fixture.submitted).toHaveLength(1);
  expect(fixture.submitted[0]).toEqual({
    subject: "Upload needs checking",
    caseNumber: "SG-TEST-1",
    message: "The document is readable but the upload was interrupted.",
  });
  await expect(page.getByRole("button", { name: "Previous page" })).toBeDisabled();
  expect(fixture.unexpected).toEqual([]);
});

test("support failures show retry and preserve the user's unsent request", async ({ page }) => {
  const fixture = await clientPagesFixture(page);
  fixture.fail("/support-requests");
  await page.goto("/client-portal/support");
  await expect(page.getByText("Results unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  fixture.fail("");
  await page.getByRole("button", { name: /retry|try again/i }).click();
  await expect(page.getByRole("heading", { name: "Upload question 0", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New request", exact: true }).click();
  await page.getByLabel("What is it about?").fill("Document upload interrupted");
  await page
    .getByLabel("Describe the problem")
    .fill("Please help me retry the interrupted upload.");
  fixture.fail("/support-requests");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByRole("button", { name: "Submit request" })).toBeEnabled();
  await expect(page.getByLabel("What is it about?")).toHaveValue("Document upload interrupted");
  await expect(page.getByLabel("Describe the problem")).toHaveValue(
    "Please help me retry the interrupted upload.",
  );
  expect(fixture.submitted).toHaveLength(0);
  fixture.fail("");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText("Support request sent", { exact: true })).toBeVisible();
  expect(fixture.submitted).toHaveLength(1);
});

for (const route of ["reports", "billing", "actions", "analytics", "support"]) {
  for (const width of [390, 1440]) {
    test(`${route} page is usable at ${width}px`, async ({ page }) => {
      const fixture = await clientPagesFixture(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/client-portal/${route}`);
      await expect(page.locator(".client-register").first()).toBeVisible();
      await expect(page.locator(".client-register")).not.toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `test-results/client-${route}-${width}.png`, fullPage: true });
      expect(fixture.unexpected).toEqual([]);
    });
  }
}
