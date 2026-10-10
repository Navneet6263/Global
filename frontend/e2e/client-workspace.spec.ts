import { expect as baseExpect, test } from "@playwright/test";
import { clientWorkspaceFixture } from "./fixtures/client-workspace-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("client overview uses compact live queues, working filters, pagination and export", async ({
  page,
}) => {
  const fixture = await clientWorkspaceFixture(page);
  await page.goto("/client-portal");
  await expect(page.getByRole("heading", { name: "Verification overview" })).toBeVisible();
  await expect(page.getByText("1–6 of 23 cases", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("7–12 of 23 cases", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Document review 5", exact: true }).click();
  await page.getByRole("button", { name: "Documents 5", exact: true }).click();
  await expect(page).toHaveURL(/status=DOCUMENT_PENDING/);
  await expect(page.getByText("1–5 of 5 cases", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open case for Candidate 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("searchbox", { name: "Search candidate or case number" }).fill("missing");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("No cases found", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  await page.getByRole("link", { name: /^Completed 5$/ }).click();
  await expect(page).toHaveURL(/verifications.*status=COMPLETED/);
  await expect(page.getByText("1–5 of 5 cases", { exact: true })).toBeVisible();
  expect(fixture.unexpected).toEqual([]);
});

test("URL navigation restores filters and closes a case on browser Back", async ({ page }) => {
  await clientWorkspaceFixture(page);
  await page.goto("/client-portal/verifications?q=Candidate%201&status=DOCUMENT_PENDING");
  await expect(page.getByRole("searchbox")).toHaveValue("Candidate 1");
  await page.getByRole("button", { name: "Open case for Candidate 1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Case detail" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Case detail" })).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveValue("Candidate 1");
});

test("a completed case shows its released report where it says verification completed", async ({
  page,
}) => {
  const { requests } = await clientWorkspaceFixture(page);
  await page.goto("/client-portal/verifications?status=COMPLETED");
  const row = page.locator("tr").filter({ hasText: "SG-TEST-3" }).first();
  await expect(row.getByText("Report ready to download")).toBeVisible();
  const download = page.waitForEvent("download");
  await row.getByRole("button", { name: "Download report for Candidate 3" }).click();
  expect((await download).suggestedFilename()).toBe("Sapling-Global-SG-TEST-3.pdf");
  expect(requests.some((url) => url.pathname.endsWith("/reports/report-3/content"))).toBe(true);
  await row.getByRole("button", { name: "Open case for Candidate 3", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Case detail" });
  const ready = drawer.getByRole("region", { name: "Final report" });
  await expect(ready.getByText("Final report ready")).toBeVisible();
  await expect(ready.getByRole("button", { name: "Download report" })).toBeVisible();
  await page.screenshot({ path: "test-results/client-report-ready.png" });
});

test("queue updates retain their layout and errors are not shown as empty results", async ({
  page,
}) => {
  const fixture = await clientWorkspaceFixture(page);
  await page.goto("/client-portal/verifications");
  await expect(page.getByText("1–6 of 23 cases", { exact: true })).toBeVisible();
  fixture.delay(1200);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(/Showing previous results/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open case for Candidate 1", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("7–12 of 23 cases", { exact: true })).toBeVisible();
  fixture.delay(0);
  fixture.fail(true);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Test queue unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("No cases found", { exact: true })).toHaveCount(0);
  fixture.fail(false);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("13–18 of 23 cases", { exact: true })).toBeVisible();
});

for (const width of [390, 1024, 1440, 1672, 1920]) {
  test(`client layout and navigation fit at ${width}px`, async ({ page }) => {
    const fixture = await clientWorkspaceFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/client-portal");
    await expect(page.getByText("1–6 of 23 cases", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New verification", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    const heading = page.getByRole("heading", { name: "Verification overview" });
    expect(await heading.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
    expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(248, 250, 252)",
    );
    await page.screenshot({ path: `test-results/client-workspace-${width}.png`, fullPage: true });
    if (width < 1280) await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page
        .getByRole("navigation", { name: "client-admin navigation" })
        .filter({ visible: true })
        .getByRole("button", { name: "Reports", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(fixture.unexpected).toEqual([]);
  });
}

test("six-row queue, expandable navigation, guide and learning controls work", async ({ page }) => {
  await clientWorkspaceFixture(page);
  await page.setViewportSize({ width: 1672, height: 1000 });
  await page.goto("/client-portal");
  await expect(page.locator(".client-case-table tbody tr")).toHaveCount(6);
  const stage = await page.getByRole("region", { name: "Verification flow" }).boundingBox();
  const context = await page
    .getByRole("complementary", { name: "Client actions and support" })
    .boundingBox();
  expect(Math.abs(stage!.y - context!.y)).toBeLessThanOrEqual(1);
  await page.getByRole("combobox", { name: "Rows per page" }).selectOption("12");
  await expect(page.locator(".client-case-table tbody tr")).toHaveCount(12);
  await expect(page.getByText("1–12 of 23 cases", { exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "client-admin navigation" });
  await nav.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(nav.getByRole("link", { name: "Published reports" })).toBeVisible();
  const helpMenu = page.getByRole("button", { name: "Help menu" });
  await helpMenu.click();
  await page.getByRole("switch", { name: "Learning mode" }).click();
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await page.getByRole("switch", { name: "Learning mode" }).click();
  await expect(page.getByRole("region", { name: "Page learning guide" })).toHaveCount(0);
  await page.getByRole("button", { name: "Help with this page" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("read-only client cannot see case creation controls", async ({ page }) => {
  await clientWorkspaceFixture(page, false);
  await page.goto("/client-portal");
  await expect(page.getByText("1–6 of 23 cases", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "New verification", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import CSV", exact: true })).toHaveCount(0);
});

test("the company admin always sees its RM, with email and phone", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clientWorkspaceFixture(page);
  await page.goto("/client-portal");
  const card = page.getByRole("complementary", { name: "Client actions and support" });
  await expect(card.getByText("Niku Sharma")).toBeVisible();
  await expect(card.getByText("Contact not available yet")).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Email your RM" })).toHaveAttribute(
    "href",
    "mailto:niku@saplingglobal.example",
  );
  await expect(card.getByRole("link", { name: "+919876543210" })).toBeVisible();
  // The RM lives in the dashboard card only, not in the page header.
  await expect(page.getByRole("button", { name: /Your RM/ })).toHaveCount(0);
  await card.getByText("Niku Sharma").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/client-rm.png" });
});

test("the company admin escalates a delayed case with a reason", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await clientWorkspaceFixture(page);
  await page.goto("/client-portal?caseId=client-case-2");
  const workspace = page.getByRole("dialog", { name: "Case detail" });
  await workspace.getByRole("button", { name: "Escalate" }).click();
  const dialog = page.getByRole("dialog", { name: "Escalate this case" });
  const submit = dialog.getByRole("button", { name: "Escalate case" });
  await dialog.getByRole("textbox").fill("Too short");
  await expect(submit).toBeDisabled();
  await dialog.getByRole("textbox").fill("Candidate joins Monday; we need the report by Friday.");
  await page.screenshot({ path: "test-results/client-escalate.png" });
  await submit.click();
  await expect(workspace.getByText("Escalated · RM handling on priority")).toBeVisible();
  expect(fixture.escalations).toEqual([
    { version: 1, reason: "Candidate joins Monday; we need the report by Friday." },
  ]);
  expect(fixture.unexpected).toEqual([]);
});

test("Route A: the company admin approves one submission and returns another", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await clientWorkspaceFixture(page);
  const calls: Array<{ path: string; body: unknown }> = [];
  const item = (id: string, name: string) => ({
    id,
    caseNumber: `SG-${id}`,
    version: 3,
    candidateName: name,
    state: "TO_REVIEW",
    since: "2026-10-07T10:00:00Z",
    documents: [
      { id: `doc-${id}`, type: "EDUCATION_CERTIFICATE", status: "UPLOADED", currentVersion: 1 },
    ],
  });
  await page.route("**/api/v1/client-review**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          items: [
            item("11111111-1111-4111-8111-111111111111", "Asha Rao"),
            item("22222222-2222-4222-8222-222222222222", "Vikram Singh"),
          ],
        },
      });
    calls.push({ path, body: route.request().postDataJSON() });
    return route.fulfill({
      json: path.endsWith("/approve")
        ? { approved: true, autoAssigned: false }
        : { returned: true, candidateNotified: true },
    });
  });
  await page.goto("/client-portal/review");
  await expect(page.getByRole("heading", { name: "Review submissions", level: 1 })).toBeVisible();
  await expect(page.getByText("Waiting for your review")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Documents from Asha Rao" }).getByText("Education certificate"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/client-review.png", fullPage: true });
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({
    path: "/client-review/11111111-1111-4111-8111-111111111111/approve",
    body: { version: 3 },
  });
  await page.getByRole("button", { name: "Return to candidate" }).nth(1).click();
  const dialog = page.getByRole("dialog", { name: "Return to Vikram Singh" });
  await dialog
    .getByRole("textbox")
    .fill("The degree certificate is cut off. Upload the full page.");
  await dialog.getByRole("button", { name: "Send back" }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1]).toEqual({
    path: "/client-review/22222222-2222-4222-8222-222222222222/return",
    body: { version: 3, reason: "The degree certificate is cut off. Upload the full page." },
  });
  expect(fixture.unexpected).toEqual([]);
});
