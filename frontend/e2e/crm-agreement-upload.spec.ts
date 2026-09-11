import { expect, test } from "@playwright/test";
import { agreementFixture } from "./fixtures/agreement-browser-fixture";

test("Sales saves a contract reference and uploads an original with an integrity digest", async ({
  page,
}) => {
  const { dialog, uploads, unexpected } = await agreementFixture(page);
  await dialog.getByRole("button", { name: "Upload new revision" }).click();
  await expect(dialog.getByText("r1 · test-agreement.pdf", { exact: true })).toBeVisible();
  await expect(dialog.getByText("PENDING", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Another authorised colleague must review this upload."),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).toBeDisabled();
  expect(uploads).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("a rejected CRM upload keeps the selected file and can be retried", async ({ page }) => {
  const { dialog, uploads, unexpected } = await agreementFixture(page, { rejectFirstUpload: true });
  await dialog.getByRole("button", { name: "Upload new revision" }).click();
  await expect(
    page.getByText("PDF is damaged, encrypted, or cannot be read safely", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await dialog.getByRole("button", { name: "Upload new revision" }).click();
  await expect(dialog.getByText("r1 · test-agreement.pdf", { exact: true })).toBeVisible();
  expect(uploads).toHaveLength(2);
  expect(unexpected).toEqual([]);
});

test("slow upload gives immediate busy feedback, prevents double submit and clears after completion", async ({
  page,
}) => {
  const { dialog, uploads, unexpected, releaseUpload } = await agreementFixture(page, {
    holdUpload: true,
  });
  await dialog.getByRole("button", { name: "Upload new revision" }).click();
  const submit = dialog.getByRole("button", { name: "Uploading…", exact: true });
  try {
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Uploading file…" })).toBeVisible();
    expect(await submit.evaluate((button) => getComputedStyle(button, "::before").content)).toBe(
      '""',
    );
    await submit.dispatchEvent("click");
    await expect.poll(() => uploads.length).toBe(1);
  } finally {
    releaseUpload();
  }
  await expect(dialog.getByText("r1 · test-agreement.pdf", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Uploading file…" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Upload new revision" })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(unexpected).toEqual([]);
});
