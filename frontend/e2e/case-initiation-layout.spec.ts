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

async function initiateCase(page: Page) {
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
  await expect(dialog.getByText("One secure link for the candidate")).toBeVisible();
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
    const uploadLink = dialog.getByRole("textbox", {
      name: "Candidate link",
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
    await expect(dialog.getByText(/Emailed to ca\*\*\*@example\.invalid/)).toBeVisible();
    await expect(dialog.getByText(/consent link|consent OTP/i)).toHaveCount(0);
    for (const name of ["Copy Candidate link"]) {
      const button = dialog.getByRole("button", { name, exact: true });
      await button.scrollIntoViewIfNeeded();
      await expectInsideViewport(page, button);
      await button.click();
    }
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, "testCopiedValues")))
      .toEqual([await uploadLink.inputValue()]);
    await expect(dialog.getByRole("status")).toHaveText("Candidate link copied");
    if (await details.evaluate((element) => element.scrollHeight > element.clientHeight)) {
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
    // One write: the case. Its single candidate link is issued and emailed with it.
    expect(fixture.writes).toEqual(["/cases"]);
    expect(fixture.unexpected).toEqual([]);
  });
}
