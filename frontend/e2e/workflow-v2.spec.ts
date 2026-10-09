import { readFile } from "node:fs/promises";
import { expect as baseExpect, test } from "@playwright/test";
import { workflowFixture } from "./fixtures/workflow-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("Data Entry accepts documents, then marks the case Ready for the RM", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await workflowFixture(page, "DATA_ENTRY");
  await page.goto("/data-entry");
  await expect(page.getByRole("heading", { name: "Intake queue", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Review Kabir Sethi" }).click();
  const review = page.getByRole("complementary", { name: "Intake review" });
  const ready = review.getByRole("button", { name: "Mark Ready and return to RM" });
  await expect(review.getByText(/Employment letter: reviewed/)).toBeVisible();
  await expect(ready).toBeDisabled();
  await review.getByRole("button", { name: "Accept", exact: true }).click();
  // Check-wise initiation: every check needs its details before Ready.
  const initiation = review.getByRole("region", { name: "Check-wise initiation" });
  await expect(initiation.getByText("0/2 done")).toBeVisible();
  await expect(review.getByText(/Initiate these checks: Employment, Education/)).toBeVisible();
  await initiation.getByLabel("Employment 1 Employer name").fill("Acme Pvt Ltd");
  await initiation.getByLabel("Employment 1 Tenure from").fill("2021-01-01");
  await initiation.getByLabel("Employment 1 Tenure to").fill("2024-03-31");
  await initiation.getByLabel("Employment 1 Employee code").fill("AC-1042");
  await initiation.getByRole("button", { name: "Add another" }).first().click();
  await initiation.getByLabel("Employment 2 Employer name").fill("Beta Ltd");
  await initiation.getByLabel("Employment 2 Tenure from").fill("2019-06-01");
  await initiation.getByLabel("Employment 2 Tenure to").fill("2020-12-31");
  await initiation.getByLabel("Employment 2 Employee code").fill("BT-77");
  await page.screenshot({ path: "test-results/data-entry-initiation.png", fullPage: true });
  await initiation.getByRole("button", { name: "Save initiation" }).first().click();
  await initiation.getByLabel("Education 1 Institute / college").fill("Pune University");
  await initiation.getByLabel("Education 1 Degree / course").fill("B.Com");
  await initiation.getByLabel("Education 1 Passing year").fill("2018");
  await initiation.getByRole("button", { name: "Save initiation" }).click();
  await expect(initiation.getByText("2/2 done")).toBeVisible();
  const saved = fixture.requests.find(
    (r) => r.method === "PUT" && r.path === "/workflow/cases/flow-case-1/checks/chk-emp/initiation",
  );
  expect((saved?.body as { entries: unknown[] }).entries).toHaveLength(2);
  await expect(
    review.getByText(
      "Consent accepted, checks initiated, required documents accepted and no open corrections.",
    ),
  ).toBeVisible();
  const accept = fixture.requests.find((r) => r.path === "/documents/doc-1/review");
  expect(accept?.body).toMatchObject({ decision: "VERIFIED", version: 1, documentVersion: 1 });
  await page.screenshot({ path: "test-results/workflow-data-entry.png", fullPage: true });
  await ready.click();
  await expect(page.getByText("All caught up")).toBeVisible();
  expect(
    fixture.requests.some(
      (r) => r.method === "POST" && r.path === "/workflow/cases/flow-case-1/ready",
    ),
  ).toBeTruthy();
});

test("Data Entry raises an L1 correction request", async ({ page }) => {
  const fixture = await workflowFixture(page, "DATA_ENTRY");
  await page.goto("/data-entry?caseId=flow-case-1");
  const review = page.getByRole("complementary", { name: "Intake review" });
  await review.getByRole("button", { name: "Request correction" }).click();
  await review.getByLabel("What is missing or wrong?").fill("Relieving letter missing");
  await review
    .getByLabel("Message to the candidate / client")
    .fill("Please upload the relieving letter.");
  await review.getByRole("button", { name: "Send request" }).click();
  await expect(review.getByText("Relieving letter missing")).toBeVisible();
  const created = fixture.requests.find(
    (r) => r.method === "POST" && r.path === "/cases/flow-case-1/clarifications",
  );
  expect(created?.body).toEqual({
    subject: "Relieving letter missing",
    message: "Please upload the relieving letter.",
  });
  await expect(review.getByRole("button", { name: "Mark Ready and return to RM" })).toBeDisabled();
});

test("RM routes a Ready case and blocks departments without a Team Leader", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await workflowFixture(page, "RM");
  await page.goto("/spoc-rm/work");
  const stages = page.getByRole("region", { name: "Cases by current stage" });
  await expect(stages.getByRole("button", { name: /Ready to route\s*1/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your numbers" })).toContainText(
    "Completed this week",
  );
  await expect(page.getByRole("table", { name: "Client pulse" })).toContainText(
    "Acme Technologies",
  );
  // Columns can be chosen; the choice is remembered.
  await page.getByRole("button", { name: /Columns/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Documents" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("table", { name: "Cases" }).getByRole("columnheader", { name: "Documents" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/workflow-rm-queue.png", fullPage: true });
  await page.getByRole("button", { name: "Route checks" }).click();
  const dialog = page.getByRole("dialog", { name: "Route checks to departments" });
  await expect(dialog.getByLabel("Department for Employment")).toHaveValue("dep-emp");
  await expect(dialog.getByText(/has no Team Leader/)).toBeVisible();
  const submit = dialog.getByRole("button", { name: "Route & start verification" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Department for Education").selectOption("dep-emp");
  await submit.click();
  await expect(dialog).toHaveCount(0);
  const routed = fixture.requests.find(
    (r) => r.method === "POST" && r.path === "/workflow/cases/flow-case-1/routing",
  );
  expect(routed?.body).toMatchObject({
    version: 3,
    routes: [
      { checkId: "chk-emp", departmentId: "dep-emp" },
      { checkId: "chk-edu", departmentId: "dep-emp" },
    ],
  });
});

test("RM gives final approval after QC", async ({ page }) => {
  const fixture = await workflowFixture(page, "RM");
  await page.goto("/spoc-rm/work?bucket=final_approval");
  await page.getByRole("button", { name: "Review & decide" }).click();
  const dialog = page.getByRole("dialog", { name: "Final review" });
  await expect(dialog.getByText(/QC approved by QC Team/)).toBeVisible();
  const approve = dialog.getByRole("button", { name: "Approve case" });
  await expect(approve).toBeDisabled();
  // Every check is shown first; the decision opens only after the reviewed tick.
  await expect(dialog.getByRole("region", { name: "Check results" })).toBeVisible();
  await expect(dialog.getByLabel(/Review notes/)).toHaveCount(0);
  await dialog.getByRole("checkbox", { name: /I have reviewed every check/ }).check();
  await page.screenshot({ path: "test-results/rm-final-review.png" });
  await dialog.getByLabel(/Review notes/).fill("Evidence and findings reviewed end to end.");
  await dialog.getByLabel(/Final recommendation/).fill("Clear to report: all checks verified.");
  await approve.click();
  await expect(dialog).toHaveCount(0);
  const decided = fixture.requests.find(
    (r) => r.method === "POST" && r.path === "/workflow/cases/flow-case-2/final-review",
  );
  expect(decided?.body).toMatchObject({ caseVersion: 7, decision: "APPROVED" });
});

test("Team Leader assigns a routed check to a team member", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await workflowFixture(page, "TEAM_LEADER");
  await page.goto("/verifier/team");
  await expect(page.getByRole("link", { name: /Team queue/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Waiting for a member\s*1/ })).toBeVisible();
  await page.screenshot({ path: "test-results/workflow-team-queue.png", fullPage: true });
  await page.getByRole("button", { name: "Assign", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Assign check" });
  await dialog.getByText("Priya Das").click();
  await dialog.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(page.getByText("Every check has a member")).toBeVisible();
  const assigned = fixture.requests.find((r) => r.path === "/workflow/tasks/task-1/assignee");
  expect(assigned?.body).toMatchObject({ assigneeId: "v-priya", version: 1 });
});

test("Operations sees departments, Team Leaders and gaps", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await workflowFixture(page, "OPS");
  await page.goto("/operations/departments");
  const dataEntry = page.getByRole("region", { name: "Data Entry department" });
  await expect(dataEntry.getByText("Ankit Rao").first()).toBeVisible();
  const education = page.getByRole("region", { name: "Education department" });
  await expect(education.getByText("Not set")).toBeVisible();
  await expect(page.getByRole("link", { name: "Field operations" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/workflow-departments.png", fullPage: true });
});

test("Data Entry workspace fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workflowFixture(page, "DATA_ENTRY");
  await page.goto("/data-entry?caseId=flow-case-1");
  await expect(
    page.getByRole("complementary", { name: "Intake review" }).getByText("Kabir Sethi"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});

test("RM sees escalations at once and can open only escalated cases", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await workflowFixture(page, "RM");
  await page.goto("/spoc-rm/work");
  const alert = page.getByRole("alert").filter({ hasText: "escalated case" });
  await expect(alert).toContainText("1 escalated case needs you now");
  const row = page.getByRole("row").filter({ hasText: "Meera Joshi" });
  await expect(row.getByText("Escalated", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/rm-escalation.png", fullPage: true });
  await alert.getByRole("button", { name: /View escalations/ }).click();
  await expect(page).toHaveURL(/flag=escalated/);
  await expect
    .poll(() =>
      fixture.requests.some(
        (request) =>
          request.path === "/workflow/rm/queue" && request.query?.includes("flag=escalated"),
      ),
    )
    .toBe(true);
});

test("Data Entry sees a dashboard and downloads a custom report", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  const fixture = await workflowFixture(page, "DATA_ENTRY");
  await page.goto("/data-entry/overview");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  const summary = page.getByRole("region", { name: "Data Entry summary" });
  await expect(summary.getByText("Marked Ready today")).toBeVisible();
  await expect(page.getByRole("region", { name: "Recent output" }).getByText("31")).toBeVisible();
  await expect(page.getByText("Meera Iyer")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Cases marked Ready per day" }).getByRole("listitem"),
  ).toHaveCount(14);
  await page.screenshot({ path: "test-results/data-entry-dashboard.png", fullPage: true });

  await page
    .getByRole("link", { name: /My reports/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "My reports", level: 1 })).toBeVisible();
  const preview = page.getByRole("table", { name: "Report preview" });
  await expect(preview.getByRole("cell", { name: "SG-2026-0009" })).toBeVisible();
  await page.getByRole("button", { name: "This month" }).click();
  await expect
    .poll(() => fixture.requests.filter((r) => r.path === "/workflow/data-entry/report").length)
    .toBeGreaterThan(1);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  await downloaded;
  const exported = fixture.requests.find((r) => r.path === "/workflow/data-entry/report/export");
  expect(exported?.query).toContain("columns=caseNumber");
  await page.screenshot({ path: "test-results/data-entry-reports.png", fullPage: true });
});

test("Data Entry review opens as a roomy slide-over on a laptop", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await workflowFixture(page, "DATA_ENTRY");
  await page.goto("/data-entry");
  await page.getByRole("button", { name: "Review Kabir Sethi" }).click();
  const review = page.getByRole("complementary", { name: "Intake review" });
  await expect(review.getByText("Kabir Sethi")).toBeVisible();
  await expect(review.getByRole("button", { name: "Mark Ready and return to RM" })).toBeVisible();
  const work = review.locator(".dei-panel-body");
  expect((await work.boundingBox())?.height ?? 0).toBeGreaterThan(640);
  expect((await review.boundingBox())?.width ?? 0).toBeGreaterThan(900);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/data-entry-review-laptop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/data-entry-review-phone.png" });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.keyboard.press("Escape");
  await expect(review).toHaveCount(0);
  await expect(page).not.toHaveURL(/caseId=/);
  await page.screenshot({ path: "test-results/data-entry-queue-laptop.png" });
});

test("Team Leader takes a check personally and exports a custom team sheet", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await workflowFixture(page, "TEAM_LEADER");
  await page.goto("/verifier/team");
  await page.screenshot({ path: "test-results/tl-team-queue.png" });
  await page.getByRole("button", { name: "Take Employment check for Kabir Sethi" }).click();
  await expect(page.getByText("Employment check is yours")).toBeVisible();
  const taken = fixture.requests.find((r) => r.path === "/workflow/tasks/task-1/assignee");
  expect(taken?.body).toMatchObject({ assigneeId: "v-neeraj", version: 1 });
  await page
    .getByRole("group", { name: "Which checks" })
    .getByRole("button", { name: "My picks" })
    .click();
  await expect(page.getByRole("link", { name: "Open", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Export team checks/ });
  await dialog.getByRole("button", { name: "Remove Status" }).click();
  await dialog.getByRole("button", { name: "Department", exact: true }).click();
  await page.screenshot({ path: "test-results/tl-export-dialog.png" });
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  const file = await download;
  const text = await readFile(await file.path(), "utf8");
  expect(text.split("\r\n")[0]).toBe(
    '﻿"Sapling ID","Candidate","Company","Check","Assigned to","Due","Department"',
  );
  expect(text).toContain('"SG-FLOW-001","Kabir Sethi","Horizon Tech","Employment","Neeraj Gupta"');
  await expect
    .poll(() => fixture.requests.find((r) => r.path === "/audit-events/exports")?.body)
    .toMatchObject({ source: "team-queue", rows: 1 });
});
