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

test("operations Case 360 distinguishes HTTP 500 with retry from HTTP 404 and maps L2 clarifications", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const now = Date.now();
  const iso = (h: number) => new Date(now + h * 3_600_000).toISOString();
  let return500 = true;

  const listItems = [
    {
      id: "case-ops-500",
      caseNumber: "SG-20261111-0727E3",
      externalRef: null,
      status: "CLARIFICATION_PENDING",
      priority: "NORMAL",
      dueAt: iso(48),
      completedAt: null,
      riskLevel: "LOW",
      version: 3,
      createdAt: iso(-24),
      updatedAt: iso(-1),
      subject: { publicId: "sub-1", fullName: "Nikhil Ranjan" },
      client: { publicId: "cli-1", code: "SG", displayName: "Sapling Global" },
      reports: [],
      servicePackage: { publicId: "pkg-1", code: "STD", name: "Standard", tatHours: 72 },
      services: [],
      branch: null,
      assignedOpsUser: { publicId: "ops-1", displayName: "Ashish" },
      checks: [{ publicId: "chk-1", type: "ADDRESS", status: "IN_PROGRESS", dueAt: iso(48) }],
    },
    {
      id: "case-ops-404",
      caseNumber: "SG-20261111-GONE01",
      externalRef: null,
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueAt: iso(24),
      completedAt: null,
      riskLevel: "MEDIUM",
      version: 1,
      createdAt: iso(-12),
      updatedAt: iso(-2),
      subject: { publicId: "sub-2", fullName: "Missing Candidate" },
      client: { publicId: "cli-1", code: "SG", displayName: "Sapling Global" },
      reports: [],
      servicePackage: { publicId: "pkg-1", code: "STD", name: "Standard", tatHours: 72 },
      services: [],
      branch: null,
      assignedOpsUser: null,
      checks: [],
    },
  ];

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (json: unknown) => route.fulfill({ json });
    if (path === "/auth/me") {
      return reply({
        id: "ops-1",
        tenantId: "t-1",
        tenantName: "Sapling Global",
        displayName: "Operations Manager",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    }
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/cases/facets") return reply({ clients: [], owners: [] });
    if (path === "/cases") return reply({ items: listItems, total: 2, page: 1, pageSize: 10 });
    if (path === "/cases/case-ops-500") {
      if (return500) {
        return route.fulfill({
          status: 500,
          contentType: "application/problem+json",
          body: JSON.stringify({
            title: "INTERNAL_SERVER_ERROR",
            status: 500,
            detail: "An unexpected error occurred",
          }),
        });
      }
      return reply({
        ...listItems[0],
        fieldVisits: [],
        qaReviewer: null,
        statusHistory: [],
        consents: [],
        documents: [],
        qaReviews: [],
        clarifications: [
          {
            publicId: "clar-1",
            level: "L2",
            status: "CANDIDATE_SUBMITTED",
            subject: "Address proof resubmission",
            createdAt: iso(-2),
          },
          {
            publicId: "clar-2",
            level: "L2",
            status: "DATA_ENTRY_PENDING",
            subject: "Employment proof re-entry",
            createdAt: iso(-1),
          },
        ],
      });
    }
    if (path === "/cases/case-ops-404") {
      return route.fulfill({
        status: 404,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "NOT_FOUND", status: 404, detail: "Case not found" }),
      });
    }
    return reply({});
  });

  await page.goto("/operations/cases");
  await page.getByRole("button", { name: "Open" }).first().click();
  await expect(page.getByText("Could not load case details")).toBeVisible();
  await expect(page.getByText("Case detail is unavailable")).toHaveCount(0);

  return500 = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("tab", { name: "Clarifications" })).toBeVisible();
  await page.getByRole("tab", { name: "Clarifications" }).click();
  await expect(page.getByText("Response received")).toBeVisible();
  await expect(page.getByText("Under review")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).first().click();
  await page.getByRole("button", { name: "Open" }).nth(1).click();
  await expect(page.getByText("Case detail is unavailable")).toBeVisible();
});
