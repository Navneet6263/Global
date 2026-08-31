import { expect, test, type Page, type TestInfo } from "@playwright/test";

const enabled = process.env.E2E_VISUAL_REVIEW === "true";
const credentials = {
  tenantCode: process.env.E2E_TENANT_CODE,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

const workspaces: Array<{ path: string; name: string; title: RegExp }> = [
  { path: "/admin", name: "control-tower", title: /Control Tower/i },
  { path: "/admin/analytics", name: "analytics", title: /Executive Analytics/i },
  { path: "/admin/sales", name: "sales-oversight", title: /Sales & CRM Oversight/i },
  { path: "/admin/cases", name: "cases", title: /Verification Register/i },
  { path: "/admin/verifier", name: "verifier-oversight", title: /Verifier Operations/i },
  { path: "/admin/qa", name: "qa-oversight", title: /QA Review Oversight/i },
  { path: "/admin/exceptions", name: "exceptions", title: /Exception Oversight/i },
  { path: "/admin/field", name: "field-oversight", title: /Field Operations Oversight/i },
  { path: "/admin/clients", name: "clients", title: /Client Management/i },
  { path: "/admin/client-portal", name: "client-oversight", title: /Client Portfolio Oversight/i },
  { path: "/admin/finance", name: "finance-oversight", title: /Finance & Billing Oversight/i },
  { path: "/admin/users", name: "users", title: /User IDs & Access/i },
  { path: "/admin/settings", name: "settings", title: /Platform Settings/i },
  { path: "/admin/audit", name: "audit", title: /Audit Trail/i },
  { path: "/admin/security", name: "security", title: /Account Security/i },
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
      await expect(page).toHaveTitle(workspace.title, { timeout: 45_000 });
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
  await page.goto("/auth");
  await page.getByLabel("Work email").fill(credentials.email!);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password!);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" && candidate.url().endsWith("/api/v1/auth/login"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await response).status()).toBe(201);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 45_000 });
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
