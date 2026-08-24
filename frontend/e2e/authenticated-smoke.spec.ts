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
    ["/", /Verification control tower/i],
    ["/exceptions", /Exception command centre/i],
    ["/verifier", /Verifier/i],
    ["/qa-review", /QA/i],
    ["/field-executive", /My verification visits/i],
    ["/client-portal", /Verification workspace/i],
    ["/executive", /Executive/i],
    ["/sales-crm", /Sales/i],
    ["/finance", /Finance/i],
    ["/settings", /Platform settings/i],
    ["/security", /Account security/i],
  ];
  for (const [path, heading] of workspaces) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
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
  await expect(page).not.toHaveURL(/\/login/);
  await page.getByRole("button", { name: /logout/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Workspace code").fill(credentials.tenantCode!);
  await page.getByLabel("Work email").fill(credentials.email!);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password!);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/v1/auth/login"),
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: /enter workspace/i }).click();
  expect((await loginResponse).status()).toBe(201);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
}
