import { expect, test } from "@playwright/test";
import { agreementFixture } from "./fixtures/agreement-browser-fixture";

for (const choice of [
  { clicked: "Approve original", other: "Request replacement", status: "APPROVED" },
  { clicked: "Request replacement", other: "Approve original", status: "REJECTED" },
]) {
  test(`only ${choice.clicked} spins while contract review is pending`, async ({ page }) => {
    const fixture = await agreementFixture(page, { reviewMode: true });
    const { dialog } = fixture;
    await dialog.getByRole("button", { name: "Review", exact: true }).click();
    await dialog.getByLabel("I opened the original and checked").check();
    await dialog.getByLabel("Contract review rationale").fill("Original and signatories reviewed.");
    const clicked = dialog.getByRole("button", { name: choice.clicked, exact: true });
    const other = dialog.getByRole("button", { name: choice.other, exact: true });
    await clicked.click();
    try {
      await expect(clicked).toHaveAttribute("aria-busy", "true");
      await expect(clicked).toBeDisabled();
      await expect(other).toBeDisabled();
      await expect(other).not.toHaveAttribute("aria-busy", "true");
      expect(await other.evaluate((button) => getComputedStyle(button, "::before").content)).toBe(
        "none",
      );
      await expect(dialog.locator('button[aria-busy="true"]')).toHaveCount(1);
      await clicked.dispatchEvent("click");
      await other.dispatchEvent("click");
      await expect.poll(() => fixture.reviews).toEqual([choice.status]);
    } finally {
      fixture.releaseReview();
    }
    await expect(dialog.getByText(choice.status, { exact: true })).toBeVisible();
    await expect(dialog.locator('button[aria-busy="true"]')).toHaveCount(0);
    expect(fixture.unexpected).toEqual([]);
  });
}

test("failed review clears both controls and a different decision can be retried", async ({
  page,
}) => {
  const fixture = await agreementFixture(page, { reviewMode: true, rejectFirstReview: true });
  const { dialog } = fixture;
  await dialog.getByRole("button", { name: "Review", exact: true }).click();
  await dialog.getByLabel("I opened the original and checked").check();
  await dialog.getByLabel("Contract review rationale").fill("Original and signatories reviewed.");
  const approve = dialog.getByRole("button", { name: "Approve original", exact: true });
  const replace = dialog.getByRole("button", { name: "Request replacement", exact: true });
  await approve.click();
  fixture.releaseReview();
  await expect(
    page.getByText("Contract review changed; please retry.", { exact: true }),
  ).toBeVisible();
  await expect(approve).toBeEnabled();
  await expect(replace).toBeEnabled();
  await expect(dialog.locator('button[aria-busy="true"]')).toHaveCount(0);
  await replace.click();
  await expect(dialog.getByText("REJECTED", { exact: true })).toBeVisible();
  expect(fixture.reviews).toEqual(["APPROVED", "REJECTED"]);
  expect(fixture.unexpected).toEqual([]);
});
