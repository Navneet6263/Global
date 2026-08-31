import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const credentials = {
  tenantCode: process.env.E2E_TENANT_CODE,
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

test.beforeEach(async ({ page }) => {
  test.skip(
    !credentials.tenantCode || !credentials.email || !credentials.password,
    "Set E2E_TENANT_CODE, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD",
  );
  await login(page);
});

test("administrator can open every operational workspace without server failures", async ({
  page,
}) => {
  const failures: string[] = [];
  const accessibilityFailures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  });
  const workspaces: Array<[string, RegExp]> = [
    ["/admin", /Control Tower — Sapling Global Platform Admin/i],
    ["/admin/analytics", /Executive Analytics — Sapling Global/i],
    ["/admin/sales", /Sales & CRM Oversight — Sapling Global/i],
    ["/admin/cases", /Verification Register — Sapling Global/i],
    ["/admin/verifier", /Verifier Operations — Sapling Global/i],
    ["/admin/qa", /QA Review Oversight — Sapling Global/i],
    ["/admin/exceptions", /Exception Oversight — Sapling Global/i],
    ["/admin/field", /Field Operations Oversight — Sapling Global/i],
    ["/admin/clients", /Client Management — Sapling Global/i],
    ["/admin/client-portal", /Client Portfolio Oversight — Sapling Global/i],
    ["/admin/finance", /Finance & Billing Oversight — Sapling Global/i],
    ["/admin/users", /User IDs & Access — Sapling Global/i],
    ["/admin/settings", /Platform Settings — Sapling Global/i],
    ["/admin/audit", /Audit Trail — Sapling Global/i],
    ["/admin/security", /Account Security — Sapling Global/i],
  ];
  for (const [path, title] of workspaces) {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    accessibilityFailures.push(
      ...scan.violations
        .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
        .flatMap((violation) =>
          violation.nodes.map(
            (node) => `${path}: ${violation.id} - ${violation.help} (${node.target.join(" > ")})`,
          ),
        ),
    );
  }
  expect(failures).toEqual([]);
  expect(accessibilityFailures).toEqual([]);
});

test("session survives refresh and logout revokes the browser session", async ({ page }) => {
  await page.reload();
  await expect(page).not.toHaveURL(/\/auth/);
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/auth/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/);
});

async function login(page: Page) {
  await page.goto("/auth");
  await page.getByLabel("Work email").fill(credentials.email!);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password!);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/v1/auth/login"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /sign in/i }).click();
  expect((await loginResponse).status()).toBe(201);
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 45_000 });
}
