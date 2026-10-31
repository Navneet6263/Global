import { expect, test, type Page } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";

const created = {
  publicId: "client-nova",
  version: 1,
  code: "NOVAFOODS",
  legalName: "Nova Foods",
  displayName: "Nova Foods",
  status: "ACTIVE",
  slaHours: 72,
  contactName: "Asha Rao",
  contactEmail: "asha@novafoods.example",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Mocks POST /clients and records what the page sent. */
async function mockCreate(page: Page) {
  const bodies: unknown[] = [];
  await page.route("**/api/v1/clients", (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    bodies.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: created });
  });
  return bodies;
}

async function addCompany(page: Page) {
  await page.getByRole("button", { name: "Add company" }).click();
  const dialog = page.getByRole("dialog", { name: "Onboard a client" });
  await dialog.getByLabel("Company name").fill("Nova Foods");
  await dialog.getByLabel("Primary contact").fill("Asha Rao");
  await dialog.getByLabel("Contact email").fill("asha@novafoods.example");
  await dialog.getByRole("button", { name: "Create client" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Nova Foods added")).toBeVisible();
  // A new company goes straight to its set-up: documents, packages and RM.
  await expect(page).toHaveURL(/onboarding\?company=client-nova/);
}

test("Operations adds a company from Companies & RMs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await operationsOverviewFixture(page);
  const bodies = await mockCreate(page);
  await page.goto("/operations/clients");
  await expect(page.getByRole("heading", { name: "Companies & RMs", level: 1 })).toBeVisible();
  await addCompany(page);
  expect(bodies[0]).toMatchObject({
    code: "NOVAFOODS",
    legalName: "Nova Foods",
    contactName: "Asha Rao",
    contactEmail: "asha@novafoods.example",
  });
});

test("view-only Platform Admin adds a company and assigns its RM", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await operationsOverviewFixture(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-admin",
        tenantId: "test",
        displayName: "Test Admin",
        email: "admin@example.invalid",
        roles: ["PLATFORM_ADMIN"],
        permissions: ["client:read", "case:read", "user:read", "user:write", "dashboard:read"],
        viewOnly: true,
        mustChangePassword: false,
      },
    }),
  );
  const bodies = await mockCreate(page);
  await page.goto("/admin/company-rms");
  await expect(page.getByRole("heading", { name: "Companies & RMs" }).first()).toBeVisible();
  const list = page.getByRole("list", { name: "Company RM assignments" });
  await expect(list.getByText("Cedar Retail")).toBeVisible();
  // Intake rules stay with Operations.
  await expect(page.getByRole("button", { name: /Intake rules for/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/admin-company-rms.png", fullPage: true });

  await list.getByRole("button", { name: "Assign RM" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Assign company RM" });
  await dialog.getByText("Riya Mehta").click();
  await dialog.getByRole("button", { name: "Assign RM", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    fixture.requests.some(
      (entry) => entry.method === "POST" && entry.path === "/workflow/clients/client-cedar/rm",
    ),
  ).toBe(true);

  await addCompany(page);
  expect(bodies).toHaveLength(1);
});

test("Admin menu links to Companies & RMs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await operationsOverviewFixture(page);
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "test-admin",
        tenantId: "test",
        displayName: "Test Admin",
        email: "admin@example.invalid",
        roles: ["PLATFORM_ADMIN"],
        permissions: ["*"],
        mustChangePassword: false,
      },
    }),
  );
  await page.goto("/admin/company-rms");
  await expect(page.getByRole("link", { name: /Companies & RMs/ }).first()).toBeVisible();
});
