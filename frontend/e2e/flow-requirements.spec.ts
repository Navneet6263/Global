import { expect as baseExpect, test } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

const COMPANY = "11111111-1111-4111-8111-111111111111";
const PACKAGE = "22222222-2222-4222-8222-222222222222";

test("an internal team bulk-uploads employees for a company it chooses", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await operationsOverviewFixture(page);
  const posted: Array<Record<string, unknown>> = [];
  await page.route("**/api/v1/bulk-intake/clients", (route) =>
    route.fulfill({ json: { items: [{ id: COMPANY, name: "Horizon Tech" }] } }),
  );
  await page.route("**/api/v1/bulk-intake/catalog**", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: PACKAGE,
            name: "Standard BGV",
            checks: ["EMPLOYMENT"],
            tatHours: 72,
            checkRequirements: [
              {
                type: "EMPLOYMENT",
                documents: ["EMPLOYMENT_PROOF"],
                details: ["Employer name"],
              },
            ],
          },
        ],
      },
    }),
  );
  await page.route("**/api/v1/bulk-intake/rows", (route) => {
    posted.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ json: { id: "case-new", caseNumber: "SG-NEW-1" } });
  });
  await page.goto("/operations");
  await page.getByRole("button", { name: "Bulk upload" }).click();
  const dialog = page.getByRole("dialog", { name: "Import candidate cases" });
  const packages = dialog.getByLabel("Verification package");
  await expect(packages).toBeDisabled();
  await dialog.getByLabel("Company").selectOption(COMPANY);
  await expect(packages.locator("option", { hasText: "Standard BGV" })).toBeAttached();
  await packages.selectOption(PACKAGE);
  const needs = dialog.getByRole("region", { name: "Documents and details required" });
  await expect(needs.getByText("Employer name")).toBeVisible();
  await dialog.getByLabel("Candidate CSV").setInputFiles({
    name: "people.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "fullName,email,phone,employeeCode,externalRef,priority\nAsha Rao,asha@example.invalid,,,,NORMAL\n",
    ),
  });
  await dialog.getByRole("button", { name: "Create 1 cases" }).click();
  await expect(dialog.getByText("SG-NEW-1")).toBeVisible();
  expect(posted[0]).toMatchObject({
    clientId: COMPANY,
    servicePackageId: PACKAGE,
    fullName: "Asha Rao",
  });
});
