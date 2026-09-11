import { expect, test, type Locator, type Page } from "@playwright/test";
import { caseInitiationFixture } from "./fixtures/case-initiation-browser-fixture";

async function expectInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const bounds = await locator.boundingBox();
      const viewport = page.viewportSize()!;
      return Boolean(
        bounds &&
        bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= viewport.width + 1 &&
        bounds.y + bounds.height <= viewport.height + 1,
      );
    })
    .toBe(true);
}

async function initiateCase(page: Page, invite = true) {
  const dialog = page.getByRole("dialog", { name: "Initiate a verification case", exact: true });
  await expectInsideViewport(page, dialog);
  await dialog.getByLabel("Candidate name", { exact: true }).fill("Layout Test Candidate");
  await dialog.getByLabel("Email", { exact: true }).fill("candidate@example.invalid");
  await dialog.getByPlaceholder("10-digit mobile").fill("9876543210");
  await expect(dialog.getByRole("button", { name: "Continue", exact: true })).toBeEnabled();
  await expectInsideViewport(page, dialog.getByRole("button", { name: "Continue", exact: true }));
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: /Standard BGV/ }).click();
  await expectInsideViewport(page, dialog);
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  if (!invite)
    await dialog.getByRole("checkbox", { name: /Send secure document-upload link/ }).uncheck();
  await expectInsideViewport(page, dialog);
  await expectInsideViewport(
    page,
    dialog.getByRole("button", { name: "Initiate case", exact: true }),
  );
  await dialog.getByRole("button", { name: "Initiate case", exact: true }).click();
  return page.getByRole("dialog", { name: "Verification initiated", exact: true });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "short laptop", width: 1280, height: 600 },
  { name: "compact viewport", width: 768, height: 512 },
  { name: "small mobile", width: 320, height: 568 },
  { name: "mobile landscape", width: 667, height: 320 },
]) {
  test(`case initiation and access confirmation fit ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const fixture = await caseInitiationFixture(page);
    const dialog = await initiateCase(page);
    const done = dialog.getByRole("button", { name: "Done", exact: true });
    await expect(
      dialog.getByText("Preparing candidate document link", { exact: true }),
    ).toBeVisible();
    await expectInsideViewport(page, dialog);
    await expectInsideViewport(page, done);
    fixture.releaseAccess();
    const uploadLink = dialog.getByRole("textbox", {
      name: "1. Candidate document-upload link",
      exact: true,
    });
    await expect(uploadLink).toHaveValue(/candidate\/access-test#token=long-test-token/);
    await expectInsideViewport(page, dialog);
    await expectInsideViewport(page, done);
    await expectInsideViewport(page, dialog.getByRole("button", { name: "Close", exact: true }));
    const details = dialog.getByRole("region", { name: "Candidate access details" });
    expect(
      await details.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    for (const name of [
      "Copy 1. Candidate document-upload link",
      "Copy 2. Candidate consent link",
      "Copy development consent OTP",
    ]) {
      const button = dialog.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expectInsideViewport(page, button);
      await button.click();
    }
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "testCopiedValues")))
      .toEqual([
        await uploadLink.inputValue(),
        new URL("/consent/consent-test", page.url()).href,
        "246810",
      ]);
    await expect(dialog.getByRole("status")).toHaveText("OTP copied");
    if (viewport.height <= 600) {
      expect(await details.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
        true,
      );
      await details.focus();
      await page.keyboard.press("Home");
      await page.keyboard.press("End");
      await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    }
    await expectInsideViewport(page, done);
    // Copy feedback must not cover the completion action, especially on mobile.
    await done.click({ trial: true, timeout: 1000 });
    await page.screenshot({
      path: `test-results/case-success-${viewport.name.replaceAll(" ", "-")}.png`,
    });
    await done.click();
    await expect(dialog).toHaveCount(0);
    expect(fixture.writes).toEqual(["/cases", "/cases/case-test/candidate-access"]);
    expect(fixture.unexpected).toEqual([]);
  });
}

test("long invitation error remains contained and the created case can still be closed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const fixture = await caseInitiationFixture(page, true);
  const dialog = await initiateCase(page);
  fixture.releaseAccess();
  await expect(dialog.getByText("Document link was not issued", { exact: true })).toBeVisible();
  await expectInsideViewport(page, dialog);
  const details = dialog.getByRole("region", { name: "Candidate access details" });
  expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  const done = dialog.getByRole("button", { name: "Done", exact: true });
  await expectInsideViewport(page, done);
  await done.click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.writes).toEqual(["/cases", "/cases/case-test/candidate-access"]);
  expect(fixture.unexpected).toEqual([]);
});

test("confirmation still fits when candidate invitation is skipped", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 320 });
  const fixture = await caseInitiationFixture(page);
  const dialog = await initiateCase(page, false);
  await expect(dialog.getByText("Document link was not requested", { exact: true })).toBeVisible();
  await expectInsideViewport(page, dialog);
  const done = dialog.getByRole("button", { name: "Done", exact: true });
  await expectInsideViewport(page, done);
  await done.click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.writes).toEqual(["/cases"]);
  expect(fixture.unexpected).toEqual([]);
});
