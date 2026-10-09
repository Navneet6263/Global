import { expect as baseExpect, test, type Page } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20_000 });

const member = (
  id: string,
  name: string,
  role: string,
  branch: string,
  open: number,
  load: number,
  overdue = 0,
) => ({
  id,
  name,
  role,
  branch,
  activeCases: open,
  activeChecks: open,
  dueToday: overdue ? 1 : 0,
  overdue,
  completedToday: 0,
  averageTurnaroundMinutes: 180,
  relativeLoadPercent: load,
});

/** Browser-only fixture: an Operations Manager with ID creation switched on. */
async function teamFixture(page: Page) {
  const created: unknown[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/me")
      return reply({
        id: "user-ops",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Operations Manager",
        email: "ops@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: ["dashboard:read", "client:read", "case:read", "user:read", "task:write"],
        mustChangePassword: false,
      });
    if (path === "/auth/refresh") return reply({ message: "Unauthorized" }, 401);
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {}, generatedAt: "" });
    if (path === "/dashboards/verifier-capacity")
      return reply({
        members: [
          member("m1", "Asha Rao", "Verifier", "Pune", 4, 30),
          member("m2", "Vikram Singh", "Verifier", "Mumbai", 14, 95, 2),
          member("m3", "Neha Gupta", "QA Reviewer", "Pune", 9, 65),
        ],
        workload: [],
        branches: [
          { branch: "Pune", members: 2, openChecks: 13, loadPercent: 48 },
          { branch: "Mumbai", members: 1, openChecks: 14, loadPercent: 52 },
        ],
        demand: [
          { checkType: "employment", open: 12 },
          { checkType: "education", open: 7 },
        ],
        openAssignments: 5,
      });
    if (path === "/users/creation-policy")
      return reply({
        enabled: true,
        roles: ["DATA_ENTRY", "VERIFIER", "QA_REVIEWER", "SPOC_RM", "CLIENT_ADMIN"],
        branches: [{ id: "b-pune", name: "Pune", city: "Pune" }],
        tenantWideAllowed: true,
      });
    if (path === "/users" && request.method() === "GET") {
      const role = url.searchParams.get("role");
      const items = [
        {
          id: "u1",
          displayName: "Ravi Menon",
          email: "ravi@example.invalid",
          status: "ACTIVE",
          mustChangePassword: false,
          lastLoginAt: new Date().toISOString(),
          createdAt: "2026-10-01T00:00:00Z",
          version: 1,
          roles: [{ code: "SPOC_RM", name: "RM / SPOC" }],
          spocClients: [],
        },
        {
          id: "u2",
          displayName: "Priya Shah",
          email: "priya@example.invalid",
          status: "ACTIVE",
          mustChangePassword: true,
          lastLoginAt: null,
          createdAt: "2026-10-06T00:00:00Z",
          version: 1,
          branch: { publicId: "b-pune", code: "PUN", name: "Pune" },
          roles: [{ code: "DATA_ENTRY", name: "Data Entry" }],
          teams: [{ name: "Data Entry", lead: true }],
        },
      ].filter((user) => !role || user.roles.some((item) => item.code === role));
      return reply({
        items,
        total: items.length,
        page: 1,
        pageSize: 10,
        summary: { total: 2, active: 1, invited: 1, suspended: 0 },
      });
    }
    if (path === "/users" && request.method() === "POST") {
      created.push(request.postDataJSON());
      return reply(
        {
          id: "u3",
          email: "new@example.invalid",
          displayName: "New",
          status: "ACTIVE",
          mustChangePassword: true,
          version: 1,
          createdAt: "",
          roles: ["SPOC_RM"],
        },
        201,
      );
    }
    if (path.startsWith("/users/u1") && request.method() === "PATCH") {
      created.push({ patch: request.postDataJSON() });
      return reply({ id: "u1", version: 2 });
    }
    if (path === "/clients" || path.startsWith("/clients?"))
      return reply({ items: [], total: 0, nextCursor: null });
    if (path === "/users/setup-options")
      return reply({
        departments: [
          { id: "11111111-1111-4111-8111-111111111111", name: "Data Entry", kind: "DATA_ENTRY" },
          { id: "22222222-2222-4222-8222-222222222222", name: "Education", kind: "VERIFICATION" },
        ],
        access: [
          {
            role: "DATA_ENTRY",
            name: "Data Entry",
            permissions: ["case:read", "clarification:write", "document:read"],
          },
        ],
      });
    return reply({ items: [], total: 0 });
  });
  return { created };
}

test("Team shows who is loaded, filters by load, and lists user IDs", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await teamFixture(page);
  await page.goto("/operations/team");
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  const kpis = page.getByRole("list", { name: "Team summary" });
  await expect(kpis).toContainText("27");
  await expect(kpis).toContainText("5 waiting to be allocated");

  const table = page.getByRole("table", { name: "Team members" });
  // Highest load first, overdue called out in plain words.
  await expect(table.getByRole("row").nth(1)).toContainText("Vikram Singh");
  await expect(table.getByRole("row").nth(1)).toContainText("Has overdue");
  await page.getByRole("combobox", { name: "Load" }).selectOption("free");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table).toContainText("Asha Rao");
  await page.screenshot({ path: "test-results/team-workload.png", fullPage: true });

  await page.getByRole("tab", { name: "People & IDs" }).click();
  const people = page.getByRole("table", { name: "People" });
  await expect(people).toContainText("Ravi Menon");
  await expect(people).toContainText("Must set password");
  await expect(people).toContainText("TL");
  await expect(page.getByRole("region", { name: "People & IDs" })).toContainText(
    "Showing 1–2 of 2",
  );
  await page.getByRole("combobox", { name: "Filter by role" }).selectOption("DATA_ENTRY");
  await expect(people.getByRole("row")).toHaveCount(2);
  await page.screenshot({ path: "test-results/team-people.png", fullPage: true });
});

test("Create user ID walks through role, details and work, and an RM needs no company", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { created } = await teamFixture(page);
  await page.goto("/operations/team");
  await page.getByRole("button", { name: "Create user ID" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user ID" });
  await expect(dialog.getByText("Delivery team", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Client facing", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: /RM \/ SPOC/ }).click();
  await page.screenshot({ path: "test-results/team-create-user.png" });
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByPlaceholder("Rohan Iyer").fill("Kabir Rao");
  await dialog.getByPlaceholder("rohan@saplingglobal.in").fill("kabir@example.invalid");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText(/companies can also be given later/)).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Kabir Rao")).toBeVisible();
  await dialog.getByRole("button", { name: "Create user ID" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({ roleCodes: ["SPOC_RM"], email: "kabir@example.invalid" });
});

test("an RM can also be Data Entry, join the team as TL and get narrowed access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { created } = await teamFixture(page);
  await page.goto("/operations/team");
  await page.getByRole("button", { name: "Create user ID" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user ID" });
  await dialog.getByRole("button", { name: /RM \/ SPOC/ }).click();
  await dialog.getByRole("button", { name: /^Data Entry/ }).click();
  await expect(dialog.getByText(/2 roles: RM \/ SPOC \+ Data Entry/)).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByPlaceholder("Rohan Iyer").fill("Meera Joshi");
  await dialog.getByPlaceholder("rohan@saplingglobal.in").fill("meera@example.invalid");
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("checkbox", { name: "Team Data Entry" }).check();
  await dialog.getByRole("checkbox", { name: "Team Leader of Data Entry" }).check();
  await dialog.getByRole("button", { name: "Next" }).click();
  await dialog.getByRole("button", { name: "Customise" }).click();
  await dialog.getByRole("checkbox", { name: "Raise insufficiency (L1 / L2)" }).uncheck();
  await expect(dialog.getByText("2 of 3 allowed")).toBeVisible();
  await page.screenshot({ path: "test-results/team-create-access.png" });
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByText("Data Entry (Team Leader)")).toBeVisible();
  await dialog.getByRole("button", { name: "Create user ID" }).click();
  await expect.poll(() => created.length).toBe(1);
  expect(created[0]).toMatchObject({
    roleCodes: ["SPOC_RM", "DATA_ENTRY"],
    additionalAccessConfirmed: true,
    departments: [{ id: "11111111-1111-4111-8111-111111111111", lead: true }],
    access: [{ role: "DATA_ENTRY", permissions: ["case:read", "document:read"] }],
  });
});

test("the Team page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await teamFixture(page);
  await page.goto("/operations/team");
  await expect(page.getByRole("table", { name: "Team members" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/team-mobile.png", fullPage: true });
});

test("Operations changes an RM to RM + Data Entry from People & IDs", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { created } = await teamFixture(page);
  await page.goto("/operations/team");
  await page.getByRole("tab", { name: "People & IDs" }).click();
  await page.getByRole("button", { name: "Actions for Ravi Menon" }).click();
  await page.getByRole("menuitem", { name: "Edit role & access" }).click();
  const dialog = page.getByRole("dialog", { name: /Edit role & access/ });
  // Operations never sees admin roles here.
  await expect(dialog.getByRole("button", { name: /Platform Admin/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: /^Data Entry/ }).click();
  await dialog.getByRole("checkbox", { name: "Confirm combined roles" }).check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(
      () => (created.find((entry) => "patch" in (entry as object)) as { patch?: unknown })?.patch,
    )
    .toMatchObject({ roleCodes: ["SPOC_RM", "DATA_ENTRY"], additionalAccessConfirmed: true });
});
