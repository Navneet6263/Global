import { expect as baseExpect, test } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20_000 });

const now = Date.now();
const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
const caseDetail = {
  id: "case-1",
  caseNumber: "SG-20261007-4F2A",
  externalRef: null,
  status: "IN_PROGRESS",
  priority: "NORMAL",
  dueAt: iso(30),
  completedAt: null,
  riskLevel: null,
  version: 4,
  createdAt: iso(-50),
  updatedAt: iso(-2),
  subject: { publicId: "s-1", fullName: "Aarav Sharma", email: null, phone: null },
  client: { publicId: "client-1", code: "HZN", displayName: "Horizon Tech" },
  servicePackage: { publicId: "p-1", code: "PRO", name: "Pro package", tatHours: 120 },
  services: [],
  branch: null,
  assignedOpsUser: { publicId: "rm-riya", displayName: "Riya Mehta" },
  workflow: {
    version: 2,
    intakeStage: "ROUTED",
    dataEntryAssignedAt: iso(-40),
    dataEntryReadyAt: iso(-30),
    dataEntryUser: { publicId: "de-1", displayName: "Ankit Rao" },
    companyRm: { publicId: "rm-riya", displayName: "Riya Mehta" },
  },
  checks: [
    {
      publicId: "chk-1",
      type: "EMPLOYMENT",
      status: "COMPLETED",
      result: "CLEAR",
      disposition: "GREEN",
      department: { publicId: "d-1", name: "Employment" },
      tasks: [
        {
          publicId: "t-1",
          status: "COMPLETED",
          version: 2,
          assignee: { publicId: "v-1", displayName: "Priya Das", email: "p@example.invalid" },
        },
      ],
    },
    {
      publicId: "chk-2",
      type: "EDUCATION",
      status: "IN_PROGRESS",
      department: { publicId: "d-2", name: "Education" },
      tasks: [
        {
          publicId: "t-2",
          status: "IN_PROGRESS",
          version: 1,
          assignee: { publicId: "v-2", displayName: "Neeraj Gupta", email: "n@example.invalid" },
        },
      ],
    },
    {
      publicId: "chk-3",
      type: "ADDRESS",
      status: "PENDING",
      department: { publicId: "d-3", name: "Address / DAV" },
      tasks: [],
    },
  ],
  fieldVisits: [],
  qaReviewer: null,
  statusHistory: [],
  consents: [],
  documents: [],
  clarifications: [],
  qaReviews: [],
  reports: [],
};

test("Case 360 shows who handles the case, from company RM to QC", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me")
      return reply({
        id: "u-ops",
        tenantId: "t-1",
        tenantName: "Sapling Global",
        displayName: "Platform Admin",
        email: "admin@example.invalid",
        roles: ["PLATFORM_ADMIN"],
        permissions: ["dashboard:read", "case:read", "client:read", "notification:read"],
        viewOnly: true,
        mustChangePassword: false,
      });
    if (path === "/cases/case-1") return reply(caseDetail);
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    return reply({ items: [], total: 0, facets: {} });
  });
  await page.goto("/admin/cases?caseId=case-1");
  const panel = page.getByRole("region", { name: "Who is handling this case" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("From company", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Company RM: Riya Mehta/)).toBeVisible();
  await expect(panel.getByText("Ankit Rao")).toBeVisible();
  await expect(panel.locator("header")).toContainText("Now with Neeraj Gupta");
  await expect(panel.locator("ol").getByText("Neeraj Gupta")).toBeVisible();
  await expect(panel.getByText("Waiting for Team Leader")).toBeVisible();
  await panel.screenshot({ path: "test-results/case-360-responsibility.png" });

  // Customize: each person chooses which Case 360 sections and tabs to see.
  await page.getByRole("button", { name: /Customize/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Who is handling this case" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Timeline" }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Timeline" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Checks" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Field photos" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Checks" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Who is handling this case" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Customize/ })).toBeInViewport();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/case-360-customized.png" });
});
