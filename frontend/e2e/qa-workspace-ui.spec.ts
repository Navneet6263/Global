import { readFile } from "node:fs/promises";
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
  // Help and learning live in one Help menu.
  await page.getByRole("button", { name: "Help menu" }).click();
  await page.getByRole("button", { name: "Help with this page" }).click();
  await page.getByRole("button", { name: "Which QA view should I use?", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("Corrections tracks cases returned");
  await page
    .getByRole("button", { name: "Does approval instantly produce a PDF?", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText("independent manager review");
  await expect(page.getByRole("log")).toContainText("actual full payment before client release");
  await page.keyboard.press("Escape");
  await page.getByRole("checkbox", { name: "Available to claim only", exact: true }).check();
  await expect.poll(() => fixture.views.includes("available")).toBe(true);
  await page.getByRole("link", { name: "My reviews", exact: true }).click();
  await expect(page.getByText("No cases match this search.")).toBeVisible();
  await page.getByRole("link", { name: "Corrections", exact: true }).click();
  await expect(page.getByText("Reconfirm the employment source.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit controlled decision" })).toHaveCount(0);
  const detailsBeforeHistory = fixture.details.length;
  await page.getByRole("link", { name: "Decision history", exact: true }).click();
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
  await page.getByRole("button", { name: "Quality & decision" }).click();
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
  await expect(page.getByRole("button", { name: "Renew", exact: true })).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.getByRole("button", { name: "Release", exact: true })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(submit).not.toHaveAttribute("aria-busy", "true");
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

test("QA exports its queue and decision history with chosen columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await qaBrowserFixture(page);
  await page.goto("/qa-review");
  await expect(page.getByRole("heading", { name: "Review queue", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Export review queue/ });
  await dialog.getByRole("button", { name: "Claimed by", exact: true }).click();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download CSV" }).click();
  const text = await readFile(await (await download).path(), "utf8");
  expect(text.split("\r\n")[0]).toBe(
    '﻿"Sapling ID","Candidate","Company","Status","Checks complete","Highest risk","Due","Claimed by"',
  );
  expect(text.split("\r\n")).toHaveLength(3);
  await expect
    .poll(() => fixture.exports)
    .toEqual([expect.objectContaining({ source: "qa-queue", rows: 2 })]);
  await page.screenshot({ path: "test-results/qa-queue-new.png" });

  await page.goto("/qa-review/history");
  await expect(page.getByText("QA-TEST-001")).toBeVisible();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const history = page.getByRole("dialog", { name: /Export decision history/ });
  const second = page.waitForEvent("download");
  await history.getByRole("button", { name: "Download CSV" }).click();
  const decisions = await readFile(await (await second).path(), "utf8");
  expect(decisions).toContain('"QA-TEST-001","QA Test Candidate","QA Test Organisation","Rework"');
  await page.screenshot({ path: "test-results/qa-history-new.png" });
  expect(fixture.unexpected).toEqual([]);
});
