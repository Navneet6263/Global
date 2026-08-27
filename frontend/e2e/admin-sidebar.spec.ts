import { expect, test } from "@playwright/test";

const credentials = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

test("Platform Admin wildcard access keeps every sidebar section visible", async ({ page }) => {
  test.skip(!credentials.email || !credentials.password, "Admin credentials are required");

  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) =>
    browserErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ""}`),
  );

  await page.goto("/auth");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Work email").fill(credentials.email!);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password!);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/v1/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await loginResponse).status()).toBe(201);
  expect(browserErrors, browserErrors.join("\n")).toEqual([]);
  await expect(page).toHaveURL(/\/admin(?:\/|$)/, { timeout: 30_000 });

  for (const label of [
    "Control Tower",
    "Executive Analytics",
    "Sales & CRM",
    "Cases & Delivery",
    "Verifier Operations",
    "QA Review",
    "Exceptions",
    "Field Operations",
    "Clients",
    "Client Portal Preview",
    "Finance & Billing",
    "User IDs & Access",
    "Platform Settings",
    "Audit Trail",
    "Account Security",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});
