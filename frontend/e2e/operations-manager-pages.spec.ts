import { expect as baseExpect, test } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("overview shows performance analytics from the executive dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await operationsOverviewFixture(page);
  await page.goto("/operations");
  const metrics = page.getByRole("region", { name: "Operations summary" });
  await expect(metrics.getByRole("link", { name: /On-time\s*92%/ })).toBeVisible();
  const analytics = page.getByRole("region", { name: "Performance and MIS" });
  await expect(analytics.getByText("3.6 d")).toBeVisible();
  await expect(
    analytics.getByRole("region", { name: "Client performance" }).getByText("Horizon Tech"),
  ).toBeVisible();
  await expect(
    analytics.getByRole("region", { name: "RM workload" }).getByText("Riya Mehta"),
  ).toBeVisible();
  await analytics.getByRole("button", { name: "12 months" }).click();
  await expect
    .poll(() =>
      fixture.requests.some(
        (entry) => entry.path === "/dashboards/executive" && entry.query.get("months") === "12",
      ),
    )
    .toBeTruthy();
  await page.screenshot({ path: "test-results/operations-performance.png", fullPage: true });
});

test("custom report builds Excel and CSV files with the chosen column order", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsOverviewFixture(page);
  await page.goto("/operations/reports");
  await expect(page.getByRole("heading", { name: "Reports & MIS" })).toBeVisible();
  await page.getByRole("radio", { name: /TAT & ageing report/ }).click();
  await page.getByRole("button", { name: /Customise columns/ }).click();
  await page.getByRole("button", { name: "Move Candidate up" }).click();
  await page.getByRole("checkbox", { name: "Responsible RM" }).check();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Prepare report" }).click();
  await expect(page.getByText("14 rows ready")).toBeVisible();
  const preview = page.getByRole("region", { name: "Report preview" });
  await expect(preview.getByRole("columnheader").first()).toHaveText("Candidate");
  await expect(preview.getByRole("columnheader").last()).toHaveText("Responsible RM");
  await page.screenshot({ path: "test-results/operations-reports.png", fullPage: true });
  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Excel" }).click();
  expect((await excel).suggestedFilename()).toMatch(
    /^Sapling-TAT-ageing-report-\d{4}-\d{2}-\d{2}\.xlsx$/,
  );
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
});

test("full case workspace shows ownership, blocker and progress", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsOverviewFixture(page);
  await page.goto("/cases/ops-case-3");
  await expect(page.getByRole("heading", { level: 1, name: "Ops Candidate 3" })).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Case progress" }).getByText("Current"),
  ).toBeVisible();
  const rail = page.getByRole("complementary", { name: "Case status and ownership" });
  await expect(rail.getByText("What is blocking this case?")).toBeVisible();
  await expect(rail.getByText("Address proof needs replacement")).toBeVisible();
  await expect(rail.getByText("Neeraj Verifier")).toBeVisible();
  await expect(page.getByRole("button", { name: "Change RM" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to work queue" })).toHaveAttribute(
    "href",
    "/operations",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/operations-case-workspace.png", fullPage: true });
});
