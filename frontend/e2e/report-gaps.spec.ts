import { expect as baseExpect, test } from "@playwright/test";
import { methodBrowserFixture } from "./fixtures/method-browser-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("verifier records verified details next to what was provided and sees mismatches", async ({
  page,
}) => {
  const fixture = await methodBrowserFixture(page);
  await page.goto("/cases/method-case");
  await page.getByRole("tab", { name: "Checks (1)", exact: true }).click();
  await page.getByRole("button", { name: "Sources & methods", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Verified details (LHS / RHS)" }).click();
  const provided = dialog.getByRole("complementary", { name: "Provided details 1" });
  await expect(provided.getByText("ABCDE1234F")).toBeVisible();
  const save = dialog.getByRole("button", { name: "Save verified details" });
  await expect(save).toBeDisabled();
  await provided.getByRole("button", { name: "Copy to verified" }).click();
  await expect(dialog.getByLabel("Verified 1 ID number (confirmed)")).toHaveValue("ABCDE1234F");
  await expect(dialog.getByText("Matches what was provided")).toBeVisible();
  await dialog.getByLabel("Verified 1 ID number (confirmed)").fill("ABCDE9999F");
  await expect(dialog.getByText(/Differs from provided: ID number/)).toBeVisible();
  await dialog.getByLabel("Verified 1 Name matches").selectOption("Yes");
  await dialog.getByLabel("Verified 1 Method of verification").selectOption("Government API");
  await dialog.getByLabel("Verified 1 Verification date").fill("2026-10-06");
  await save.click();
  await expect.poll(() => fixture.verified.length).toBe(1);
  expect(fixture.verified[0]).toEqual([
    {
      idType: "PAN",
      idNumber: "ABCDE9999F",
      nameMatch: "Yes",
      method: "Government API",
      verificationDate: "2026-10-06",
    },
  ]);
  // The shared fixture predates the case activity feed; only this feature's calls matter.
  expect(fixture.unexpected.filter((call) => call.includes("verified-details"))).toEqual([]);
});

test("verifier emails the employer with an attachment and automatic follow-ups", async ({
  page,
}) => {
  const fixture = await methodBrowserFixture(page);
  await page.goto("/cases/method-case");
  await page.getByRole("tab", { name: "Checks (1)", exact: true }).click();
  await page.getByRole("button", { name: "Sources & methods", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Source email", exact: true }).click();
  await expect(dialog.getByText("7 automatic follow-ups", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Source email message")).toHaveValue(/Candidate: Source UI Test/);
  const send = dialog.getByRole("button", { name: "Send email" });
  await expect(send).toBeDisabled();
  await dialog.getByLabel("Source email to").fill("hr@acme.test");
  await dialog.getByLabel("Source email cc").fill("team@sapling.test");
  await dialog.getByRole("checkbox", { name: /relieving\.pdf/ }).check();
  await send.click();
  await expect.poll(() => fixture.emails.length).toBe(1);
  expect(fixture.emails[0]).toMatchObject({
    to: "hr@acme.test",
    cc: ["team@sapling.test"],
    documentIds: ["11111111-1111-4111-8111-111111111111"],
    autoFollowUp: true,
  });
  await expect(dialog.getByText("Follow-ups 0/7")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Response received" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});
