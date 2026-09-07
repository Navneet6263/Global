import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const candidate = "/candidate/00000000-0000-4000-8000-000000000099";

test("page help explains the workflow without a candidate token or business requests", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) requests.push(request.url());
  });
  await page.goto(candidate);
  await expect(page.getByRole("region", { name: "Page learning guide" })).toHaveCount(0);
  const launcher = page.getByRole("button", { name: "Help with this page" });
  await launcher.click();
  await expect(
    page.getByText("authored guide, not an AI assistant", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Where do I enter the consent OTP?", exact: true })
    .click();
  await expect(page.getByRole("log")).toContainText("separate consent invitation");
  await expect(page.getByRole("log")).not.toContainText("00000000-0000");
  await page.keyboard.press("Escape");
  await expect(launcher).toBeFocused();
  expect(requests).toEqual([]);
});

test("learning mode is opt-in, survives reload and can be completely switched off", async ({
  page,
}) => {
  await page.goto(candidate);
  await page.getByRole("button", { name: "Help with this page" }).click();
  const toggle = page.getByRole("switch", { name: "Learning mode" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Page learning guide" })).toBeVisible();
  await page.getByRole("button", { name: "Help with this page" }).click();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Page learning guide" })).toHaveCount(0);
});

test("guide has keyboard-accessible controls and no serious accessibility violations", async ({
  page,
}) => {
  await page.goto(candidate);
  await page.getByRole("button", { name: "Help with this page" }).click();
  await expect(
    page.getByRole("button", { name: "What is this page for?", exact: true }),
  ).toBeVisible();
  const scan = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")),
  ).toEqual([]);
  await page.getByRole("textbox", { name: "Find a help topic" }).fill("zz-no-topic-zz");
  await expect(page.getByText("No matching topic on this page.", { exact: false })).toBeVisible();
});

test("help fits a narrow viewport and changes instructions with the page", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(candidate);
  await page.getByRole("button", { name: "Help with this page" }).click();
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(360);
  await page.screenshot({ path: "test-results/page-help-mobile.png" });
  await page.goto("/consent/00000000-0000-4000-8000-000000000099");
  await page.getByRole("button", { name: "Help with this page" }).click();
  await page.getByRole("button", { name: "What should I do first?", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("enter the current OTP");
  await expect(page.getByRole("log")).not.toContainText("Choose a PDF");
});
