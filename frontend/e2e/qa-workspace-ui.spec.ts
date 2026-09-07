import { expect, test } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";
import { qaChecklist } from "../src/features/delivery/utils";

test("QA summary views fetch only selected evidence and keep corrections separate", async ({
  page,
}) => {
  const fixture = await qaBrowserFixture(page);
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/qa-review$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Check results and findings" })).toBeVisible();
  // Development remounts may abort and retry the same read. No other case's evidence is loaded.
  expect([...new Set(fixture.details)]).toEqual(["qa-case-1"]);
  await page.screenshot({ path: "test-results/qa-review-layout.png" });
  await page.getByRole("button", { name: "Help with this page" }).click();
  await page.getByRole("button", { name: "Which QA view should I use?", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Corrections tracks cases returned");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Available to claim", exact: true }).click();
  await expect.poll(() => fixture.views.includes("available")).toBe(true);
  await page.getByRole("button", { name: "My claims", exact: true }).click();
  await expect(page.getByText("No cases match this search.")).toBeVisible();
  await page.getByRole("button", { name: "Corrections", exact: true }).click();
  await expect(page.getByText("Reconfirm the employment source.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit controlled decision" })).toHaveCount(0);
  const detailsBeforeHistory = fixture.details.length;
  await page.getByRole("button", { name: "My decisions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My decision history" })).toBeVisible();
  await expect(page.getByText("Current stage:", { exact: false })).toContainText("In Progress");
  expect(fixture.details.length).toBe(detailsBeforeHistory);
  expect(fixture.unexpected).toEqual([]);
});

test("QA renewal locks conflicting actions and retains rationale while resetting checks", async ({
  page,
}) => {
  const fixture = await qaBrowserFixture(page);
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/qa-review$/, { timeout: 30_000 });
  const notes = page.getByRole("textbox", { name: "Reviewer rationale" });
  await expect(notes).toBeDisabled();
  await page.getByRole("button", { name: "Claim case", exact: true }).click();
  await expect(notes).toBeEnabled();
  await notes.fill("Supporting records reviewed; source confirmation is complete.");
  for (const label of qaChecklist)
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  const submit = page.getByRole("button", { name: "Submit controlled decision" });
  await expect(submit).toBeEnabled();
  fixture.pauseRenew();
  await page.getByRole("button", { name: "Renew", exact: true }).click();
  await expect(submit).toBeDisabled();
  await expect(notes).toBeDisabled();
  await expect(page.getByRole("button", { name: "Release", exact: true })).toBeDisabled();
  fixture.resumeRenew();
  await expect(notes).toBeEnabled();
  await expect(notes).toHaveValue("Supporting records reviewed; source confirmation is complete.");
  for (const label of qaChecklist)
    await expect(page.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: "Release", exact: true }).click();
  await expect(page.getByRole("button", { name: "Claim case", exact: true })).toBeEnabled();
  await expect(notes).toBeDisabled();
  expect(fixture.unexpected).toEqual([]);
});
