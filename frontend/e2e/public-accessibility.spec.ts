import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("sign-in is keyboard operable and has no serious accessibility violations", async ({
  page,
}) => {
  const response = await page.goto("/login");
  expect(response).not.toBeNull();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

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

  await expect(page.getByLabel("Workspace code")).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Workspace code")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Work email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Show password" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Enter workspace" })).toBeFocused();
});

test("sign-in remains usable without horizontal overflow on a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");

  await expect(page.getByLabel("Workspace code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter workspace" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});
