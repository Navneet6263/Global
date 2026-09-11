import { expect, test } from "@playwright/test";
import { documentPreviewFixture } from "./fixtures/document-preview-fixture";

// Full Chromium includes the native PDF viewer; headless-shell always downloads PDFs.
test.use({ channel: "chromium" });

for (const entry of [
  { id: "pdf", label: "Pan" },
  { id: "image", label: "Aadhaar" },
]) {
  test(`${entry.id} preview opens in a new tab without triggering a download`, async ({ page }) => {
    const fixture = await documentPreviewFixture(page);
    const downloads: string[] = [];
    page.on("download", (item) => downloads.push(item.suggestedFilename()));
    await page.goto("/cases/preview-case");
    await page.getByRole("tab", { name: /^Documents/ }).click();
    const preview = page.getByRole("button", {
      name: `Preview ${entry.label} (opens in a new tab)`,
    });
    const download = page.getByRole("button", { name: `Download ${entry.label}`, exact: true });
    fixture.hold();
    const popupPromise = page.waitForEvent("popup");
    await preview.click();
    const popup = await popupPromise;
    popup.on("download", (item) => downloads.push(item.suggestedFilename()));
    try {
      await expect(preview).toHaveAttribute("aria-busy", "true");
      await expect(download).toBeDisabled();
      await expect(download).not.toHaveAttribute("aria-busy", "true");
      await expect(popup.locator("body")).toContainText("Opening secure document preview");
      expect(await popup.evaluate(() => window.opener)).toBeNull();
      await expect
        .poll(() => fixture.requests)
        .toEqual([`/documents/document-${entry.id}/preview`]);
    } finally {
      fixture.release();
    }
    await expect(popup).toHaveURL(/^blob:/);
    if (entry.id === "image")
      await expect
        .poll(() => popup.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    await expect(preview).toBeEnabled();
    await expect(download).toBeEnabled();
    expect(downloads).toEqual([]);
    expect(fixture.unexpected).toEqual([]);
    await popup.close();
  });
}

test("download remains separate and only the clicked document action spins", async ({ page }) => {
  const fixture = await documentPreviewFixture(page);
  await page.goto("/cases/preview-case");
  await page.getByRole("tab", { name: /^Documents/ }).click();
  fixture.hold();
  const download = page.getByRole("button", { name: "Download Pan", exact: true });
  const preview = page.getByRole("button", { name: "Preview Pan (opens in a new tab)" });
  const saved = page.waitForEvent("download");
  await download.click();
  try {
    await expect(download).toHaveAttribute("aria-busy", "true");
    await expect(preview).not.toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("button", { name: "Download Aadhaar", exact: true })).toBeEnabled();
  } finally {
    fixture.release();
  }
  expect((await saved).suggestedFilename()).toBe("proof.pdf");
  await expect(download).toBeEnabled();
  expect(fixture.requests).toEqual(["/documents/document-pdf/content"]);
  expect(fixture.unexpected).toEqual([]);
});

test("popup blocking shows an actionable message without requesting the document", async ({
  page,
}) => {
  const fixture = await documentPreviewFixture(page);
  await page.goto("/cases/preview-case");
  await page.getByRole("tab", { name: /^Documents/ }).click();
  await page.evaluate(() => {
    window.open = () => null;
  });
  const preview = page.getByRole("button", { name: "Preview Pan (opens in a new tab)" });
  await preview.click();
  await expect(
    page.getByText("Allow pop-ups for this site to preview documents in a new tab."),
  ).toBeVisible();
  await expect(preview).toBeEnabled();
  expect(fixture.requests).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
});

test("denied preview closes its empty tab, resets loading and allows retry", async ({ page }) => {
  const fixture = await documentPreviewFixture(page);
  fixture.controls.failNext = true;
  await page.goto("/cases/preview-case");
  await page.getByRole("tab", { name: /^Documents/ }).click();
  const preview = page.getByRole("button", { name: "Preview Pan (opens in a new tab)" });
  const deniedPopup = page.waitForEvent("popup");
  await preview.click();
  const denied = await deniedPopup;
  await expect.poll(() => denied.isClosed()).toBe(true);
  await expect(page.getByText("Document access is not allowed.")).toBeVisible();
  await expect(preview).toBeEnabled();
  const popupPromise = page.waitForEvent("popup");
  await preview.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/^blob:/);
  expect(fixture.requests).toEqual([
    "/documents/document-pdf/preview",
    "/documents/document-pdf/preview",
  ]);
  expect(fixture.unexpected).toEqual([]);
  await popup.close();
});

test("Case 360 drawer shows both actions on a narrow screen", async ({ page }) => {
  const fixture = await documentPreviewFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/operations/cases?caseId=preview-case");
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("tab", { name: "Documents", exact: true }).click();
  const preview = drawer.getByRole("button", { name: /Preview PAN/ });
  const download = drawer.getByRole("button", { name: "Download PAN", exact: true });
  await expect(preview).toBeVisible();
  await expect(download).toBeVisible();
  for (const action of [preview, download]) {
    const box = await action.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  expect(fixture.unexpected).toEqual([]);
});
