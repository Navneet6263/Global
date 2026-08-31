import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("sign-in is keyboard operable and has no serious accessibility violations", async ({
  page,
}) => {
  const response = await page.goto("/auth");
  expect(response).not.toBeNull();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();

  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    scan.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .flatMap((violation) =>
        violation.nodes.map(
          (node) => `${violation.id}: ${violation.help} (${node.target.join(" > ")})`,
        ),
      ),
  ).toEqual([]);

  const email = page.getByLabel("Work email");
  await expect(email).toBeEnabled();
  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeFocused();
});

test("sign-in remains usable without horizontal overflow on a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/auth");

  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
