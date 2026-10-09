import { expect as baseExpect, test } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("overview shows metrics, queue ownership and the selected case context", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsOverviewFixture(page);
  await page.goto("/operations");
  await expect(
    page.getByRole("heading", { name: "Operations overview", exact: true }),
  ).toBeVisible();
  const metrics = page.getByRole("region", { name: "Operations summary" });
  await expect(metrics.getByRole("link", { name: /Needs RM\s*2/ })).toBeVisible();
  await expect(metrics.getByRole("link", { name: /Completed today\s*5/ })).toBeVisible();
  const table = page.getByRole("region", { name: "Operations cases table" });
  await expect(table.getByRole("row")).toHaveCount(7);
  await expect(
    table.getByRole("button", { name: "Assign RM for Ops Candidate 1", exact: true }),
  ).toBeVisible();
  await expect(table.getByText("Overdue 2h")).toBeVisible();
  await expect(table.getByText("Neeraj Verifier")).toBeVisible();

  await table.getByRole("button", { name: "Show details for Ops Candidate 3" }).click();
  await expect(page).toHaveURL(/caseId=ops-case-3/);
  const context = page.getByRole("complementary", { name: "Selected case" });
  await expect(context.getByRole("heading", { name: "Ops Candidate 3" })).toBeVisible();
  await expect(context.getByText("Riya Mehta")).toBeVisible();
  await expect(context.getByText(/Address proof needs replacement/)).toBeVisible();
  await expect(context.getByText(/Pending since .* IST/)).toBeVisible();
  await expect(context.getByText(/Ankit Rao/)).toBeVisible();
  await expect(context.getByRole("link", { name: "Open full case" })).toHaveAttribute(
    "href",
    "/cases/ops-case-3",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/operations-overview-desktop.png" });
});

test("assign RM lists only client-mapped RMs and refreshes the queue", async ({ page }) => {
  const fixture = await operationsOverviewFixture(page);
  await page.goto("/operations?view=needs-rm");
  await expect(page.getByRole("button", { name: /Needs RM/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    fixture.requests.some(
      (entry) => entry.path === "/cases" && entry.query.get("unassigned") === "true",
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Assign RM for Ops Candidate 2", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Assign responsible RM" });
  // Cedar Retail is mapped only to Riya; Aman serves Horizon Tech.
  await expect(dialog.getByText("Riya Mehta")).toBeVisible();
  await expect(dialog.getByText("Aman Gupta")).toHaveCount(0);
  const submit = dialog.getByRole("button", { name: "Assign RM", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByText("Riya Mehta").click();
  await dialog.getByRole("textbox", { name: /Note for the audit trail/ }).fill("ok");
  await expect(dialog.getByText(/at least 3 characters/)).toBeVisible();
  await expect(submit).toBeDisabled();
  await dialog.getByRole("textbox", { name: /Note for the audit trail/ }).fill("Dedicated RM");
  await submit.click();
  await expect(dialog).toHaveCount(0);
  const patch = fixture.requests.find(
    (entry) => entry.method === "PATCH" && entry.path === "/cases/ops-case-2/owner",
  );
  expect(patch?.body).toEqual({ ownerId: "rm-riya", version: 3, note: "Dedicated RM" });
  await expect(
    page.getByRole("button", { name: "Assign RM for Ops Candidate 2", exact: true }),
  ).toHaveCount(0);
});

test("read-only operations users cannot assign, change RM or escalate", async ({ page }) => {
  await operationsOverviewFixture(page, false);
  await page.goto("/operations?caseId=ops-case-3");
  const context = page.getByRole("complementary", { name: "Selected case" });
  await expect(context.getByRole("heading", { name: "Ops Candidate 3" })).toBeVisible();
  await expect(context.getByRole("button", { name: "Change RM" })).toHaveCount(0);
  await expect(context.getByRole("button", { name: "Escalate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Assign RM for/ })).toHaveCount(0);
});

test("mobile overview has no page-level horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await operationsOverviewFixture(page);
  await page.goto("/operations?caseId=ops-case-3");
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Selected case" }).getByRole("heading", {
      name: "Ops Candidate 3",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/operations-overview-mobile.png", fullPage: true });
});
