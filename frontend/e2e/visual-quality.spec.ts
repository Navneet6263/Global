import { expect, test, type Page, type TestInfo } from "@playwright/test";

const enabled = process.env.E2E_VISUAL_REVIEW === "true";
const credentials = {
  tenantCode: process.env.E2E_TENANT_CODE,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

const workspaces: Array<{ path: string; name: string; heading: RegExp }> = [
  { path: "/", name: "operations", heading: /Operations command center/i },
  { path: "/exceptions", name: "exceptions", heading: /Exception triage/i },
  { path: "/verifier", name: "verifier", heading: /Verification workbench/i },
  { path: "/qa-review", name: "qa-review", heading: /Independent QA review/i },
  { path: "/field-executive", name: "field", heading: /My field route/i },
  { path: "/client-portal", name: "client-portal", heading: /Verification portfolio/i },
  { path: "/executive", name: "executive", heading: /Portfolio intelligence/i },
  { path: "/sales-crm", name: "sales", heading: /Revenue command/i },
  { path: "/finance", name: "finance", heading: /Revenue control/i },
  { path: "/settings", name: "settings", heading: /^Settings$/i },
  { path: "/security", name: "security", heading: /Account protection/i },
];

test("all authenticated workspaces render cleanly on desktop and mobile", async ({
  page,
}, testInfo) => {
  test.setTimeout(900_000);
  test.skip(!enabled, "Set E2E_VISUAL_REVIEW=true to generate the visual review artifacts");
  if (!credentials.tenantCode || !credentials.email || !credentials.password) {
    throw new Error("Visual review requires the E2E tenant and administrator credentials");
  }

  await login(page);
  for (const profile of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: profile.width, height: profile.height });
    for (const workspace of workspaces) {
      await page.goto(workspace.path);
      await expect(page.getByRole("heading", { name: workspace.heading }).first()).toBeVisible({
        timeout: 45_000,
      });
      await settle(page);

      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${profile.name} ${workspace.path} has horizontal page overflow`,
      ).toBeLessThanOrEqual(dimensions.clientWidth + 1);

      const screenshot = testInfo.outputPath(`${profile.name}-${workspace.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
      await testInfo.attach(`${profile.name}-${workspace.name}`, {
        path: screenshot,
        contentType: "image/png",
      });
    }
  }
});

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(credentials.email!);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password!);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" && candidate.url().endsWith("/api/v1/auth/login"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /enter workspace/i }).click();
  expect((await response).status()).toBe(201);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll<HTMLElement>(".animate-pulse")).every((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.width * bounds.height <= 256;
      }),
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(350);
}
