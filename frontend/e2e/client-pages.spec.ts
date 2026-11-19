import { expect as baseExpect, test, type Page } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

/** The Search button of the search form that holds the named searchbox. */
const searchButton = (page: Page, searchbox: string) =>
  page
    .locator("form")
    .filter({ has: page.getByRole("searchbox", { name: searchbox, exact: true }) })
    .getByRole("button", { name: "Search", exact: true });

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
  await searchButton(page, "Search reports").click();
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
  await searchButton(page, "Search reports").click();
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

test("to-do ranks the most urgent first, pages, filters by type and opens the right tab", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/actions");
  await expect(page.getByRole("heading", { name: "Your to-do", level: 1 })).toBeVisible();
  const centre = page.getByRole("region", { name: "Action centre" });
  const items = centre.locator("ol > li");
  // A rejected document outranks the open questions; Sapling's own items come last.
  await expect(items.first()).toContainText("EDUCATION needs replacement");
  await expect(items.nth(1)).toContainText("Confirm education 0");
  await expect(page.getByText("Confirm education 0", { exact: true })).toBeVisible();
  const types = page.getByRole("group", { name: "Action type" });
  for (const [label, count] of [
    ["All", 12],
    ["Documents", 1],
    ["Questions", 10],
    ["Past turnaround", 0],
    ["Being checked", 1],
  ] as const)
    await expect(
      types.getByRole("button", { name: new RegExp(`^${label}\\s*${count}$`) }),
    ).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Confirm education 8", { exact: true })).toBeVisible();
  await expect(centre.getByText("Sapling is handling these")).toBeVisible();
  await expect(
    centre.getByRole("button", { name: "View: Candidate 1", exact: true }),
  ).toBeVisible();

  // Documents open the case on its Documents tab.
  await types.getByRole("button", { name: /^Documents/ }).click();
  await expect(page.getByText("EDUCATION needs replacement", { exact: true })).toBeVisible();
  await expect(items).toHaveCount(1);
  await page.getByRole("button", { name: "Upload now: Candidate 1", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Case detail" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(
    /caseId=client-case-1.*tab=documents|tab=documents.*caseId=client-case-1/,
  );
  await expect(dialog.getByRole("tab", { name: /Documents/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goBack();
  await expect(dialog).toHaveCount(0);

  // Questions open the case on its Requests tab.
  await types.getByRole("button", { name: /^Questions/ }).click();
  await expect(items).toHaveCount(8);
  await page.getByRole("button", { name: "Reply now: Candidate 1", exact: true }).first().click();
  await expect(page).toHaveURL(/tab=requests/);
  await expect(dialog.getByRole("tab", { name: /Requests/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goBack();
  await expect(dialog).toHaveCount(0);
  expect(fixture.unexpected).toEqual([]);
});

test("insights switch between live flow, quality and searchable branch comparisons", async ({
  page,
}) => {
  const fixture = await clientPagesFixture(page);
  await page.goto("/client-portal/analytics");
  await expect(page.getByRole("heading", { name: "Stage ageing" })).toBeVisible();
  await page.getByRole("tab", { name: "Quality & rework" }).click();
  await expect(page.getByRole("heading", { name: "Document quality", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stage ageing" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Quality decisions" })).toBeVisible();
  await page.getByRole("tab", { name: "Branch comparison", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Delivery branch comparison" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search delivery branches" }).fill("unknown");
  await searchButton(page, "Search delivery branches").click();
  await expect(page.getByText("No matching branch data", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Flow & outcomes" }).click();
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

// Each page: its title and its main card, inside the viewport with no sideways scroll.
const PAGES = {
  reports: { title: "Final reports", card: "Published report library" },
  billing: { title: "Invoices & payments", card: "Invoice register" },
  actions: { title: "Your to-do", card: "Action centre" },
  analytics: { title: "Portfolio insights", card: "Page summary" },
  support: { title: "Queries & support", card: "Your support requests" },
} as const;
for (const route of Object.keys(PAGES) as Array<keyof typeof PAGES>) {
  for (const width of [390, 1440]) {
    test(`${route} page is usable at ${width}px`, async ({ page }) => {
      const fixture = await clientPagesFixture(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/client-portal/${route}`);
      await expect(
        page.getByRole("heading", { name: PAGES[route].title, level: 1, exact: true }),
      ).toBeVisible();
      const card = page.getByRole("region", { name: PAGES[route].card, exact: true });
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `test-results/client-${route}-${width}.png`, fullPage: true });
      expect(fixture.unexpected).toEqual([]);
    });
  }
}
