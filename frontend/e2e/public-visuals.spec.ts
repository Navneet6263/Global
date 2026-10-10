import { expect, test } from "@playwright/test";

// Public pages need no API; a signed-out visitor makes no session check.
test.use({ storageState: { cookies: [], origins: [] } });

const noSidewaysScroll = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

for (const width of [1440, 390]) {
  test(`landing shows glass illustrations, not screenshots, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const hero = page.getByRole("img", { name: /operations dashboard \(illustration\)/i }).first();
    await expect(hero).toBeVisible();
    expect(await page.locator('img[src*="/landing/shot-"]').count()).toBe(0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `test-results/landing-hero-${width}.png` });
    const tabs = page.getByRole("tablist", { name: "Product screens" });
    for (const [name, label] of [
      ["Operations", "operations"],
      ["Client portal", "client"],
      ["RM workspace", "rm"],
      ["Onboarding", "onboarding"],
    ] as const) {
      await tabs.getByRole("tab", { name }).click();
      const panel = page.getByRole("tabpanel");
      await expect(panel.getByRole("img", { name: new RegExp(`${name} screen`) })).toBeVisible();
      if (width === 1440) {
        await page.waitForTimeout(450);
        await panel.screenshot({ path: `test-results/tour-${label}.png` });
      }
    }
    expect(await noSidewaysScroll(page)).toBe(true);
  });
}

test("sign-in and sign-up show the glass illustration", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/auth");
  await expect(
    page.getByRole("img", { name: /operations dashboard \(illustration\)/i }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/auth-glass.png" });
  await page.goto("/signup");
  await expect(
    page.getByRole("img", { name: /onboarding checklist \(illustration\)/i }),
  ).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/signup-glass.png" });
  expect(await noSidewaysScroll(page)).toBe(true);
});
