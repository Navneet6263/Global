import { expect as baseExpect, test } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

const EDUCATION = "11111111-1111-4111-8111-111111111111";
const VENDOR = "22222222-2222-4222-8222-222222222222";

test("the role dropdown lists each Team Leader and opens only that team's queue", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await operationsOverviewFixture(page);
  const asked: Array<string | null> = [];
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "ops",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Ashish",
        email: "ashish@example.invalid",
        roles: ["OPS_MANAGER", "VERIFIER"],
        permissions: ["*"],
        departments: [
          { id: VENDOR, code: "VENDOR", name: "Vendor", kind: "VERIFICATION", role: "LEAD" },
        ],
        mustChangePassword: false,
      },
    }),
  );
  await page.route("**/api/v1/workflow/departments", (route) =>
    route.fulfill({
      json: {
        items: [
          { id: EDUCATION, name: "Education", kind: "VERIFICATION", status: "ACTIVE" },
          { id: VENDOR, name: "Vendor", kind: "VERIFICATION", status: "ACTIVE" },
          { id: "de", name: "Data Entry", kind: "DATA_ENTRY", status: "ACTIVE" },
          { id: "old", name: "Old team", kind: "VERIFICATION", status: "INACTIVE" },
        ],
      },
    }),
  );
  await page.route("**/api/v1/workflow/team/queue**", (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("departmentId"));
    return route.fulfill({
      json: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        members: [],
        counts: {},
        generatedAt: "2026-11-02T06:00:00Z",
      },
    });
  });
  await page.goto("/operations");
  await page.getByRole("button", { name: "Switch role" }).click();
  await expect(page.getByRole("menuitem", { name: /^TL Vendor/ })).toContainText(
    "You lead this team",
  );
  await expect(page.getByRole("menuitem", { name: /^TL Education/ })).toContainText(
    "Team queue of Education",
  );
  await expect(page.getByRole("menuitem", { name: /^TL Data Entry/ })).toHaveCount(0);
  // The TL choices replace a plain "Verifier" row.
  await expect(page.getByRole("menuitem", { name: /^Verifier/ })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /^TL Old team/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: /^TL Education/ }).click();
  await expect(page).toHaveURL(new RegExp(`/verifier/team\\?department=${EDUCATION}`));
  await expect(page.getByRole("button", { name: "Switch role" })).toContainText("TL Education");
  await expect(page.getByRole("heading", { name: "Team queue · Education" })).toBeVisible();
  await expect.poll(() => asked.at(-1)).toBe(EDUCATION);
});
