import { expect as baseExpect, test, type Page, type Route } from "@playwright/test";
import { clientWorkspaceFixture } from "./fixtures/client-workspace-fixture";
import { onboardingFixture } from "./fixtures/onboarding-fixture";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
import { spocFixture } from "./fixtures/spoc-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

type Handler = (
  path: string,
  method: string,
  body: unknown,
  reply: (json: unknown, status?: number) => Promise<void>,
) => Promise<void> | undefined;

/** Layers feature endpoints over a known-good workspace fixture; anything else falls back. */
async function overlay(page: Page, handler: Handler) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = `${url.pathname.replace("/api/v1", "")}${url.search}`;
    let body: unknown;
    try {
      body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    } catch {
      body = undefined;
    }
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    const handled = handler(path, request.method(), body, async (json, status) => {
      calls.push({ method: request.method(), path, body });
      await reply(json, status);
    });
    if (handled) return handled;
    return route.fallback();
  });
  return calls;
}

test("Operations re-opens a UTV check with a reason", async ({ page }) => {
  await operationsOverviewFixture(page);
  let reopened = false;
  const calls = await overlay(page, (path, method, _body, reply) => {
    if (path.startsWith("/workflow/utv"))
      return reply({
        items: [
          {
            checkId: "11111111-1111-4111-8111-111111111111",
            checkType: "EDUCATION",
            reason: "University did not respond after 3 follow-ups",
            closedAt: "2026-10-06T10:00:00Z",
            verifier: "Neeraj Verifier",
            caseId: "case-1",
            caseNumber: "SG-UTV-1",
            caseStatus: "IN_PROGRESS",
            candidateName: "Aarav Sharma",
            clientName: "Vision India",
            canRework: !reopened,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    if (path.endsWith("/rework") && method === "POST") {
      reopened = true;
      return reply({ checkId: "c", taskId: "t", assigned: true });
    }
    return undefined;
  });
  await page.goto("/operations/utv");
  await expect(page.getByRole("heading", { name: "UTV bucket", level: 1 })).toBeVisible();
  await expect(page.getByText("University did not respond after 3 follow-ups")).toBeVisible();
  await page.getByRole("button", { name: "Re-open" }).click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Re-open check" });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel("Rework reason").fill("Registrar shared a new email address");
  await submit.click();
  await expect
    .poll(() => calls.find((call) => call.path.endsWith("/rework"))?.body)
    .toEqual({
      mode: "REOPEN",
      reason: "Registrar shared a new email address",
    });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("Company Admin previews a UTV MIS and schedules it weekly", async ({ page }) => {
  await clientWorkspaceFixture(page);
  const schedules: unknown[] = [];
  const calls = await overlay(page, (path, method, body, reply) => {
    if (path.startsWith("/client-reports/mis?")) {
      const utv = path.includes("preset=UTV");
      return reply({
        preset: utv ? "UTV" : "CASE_STATUS",
        title: utv ? "Unable to verify (UTV)" : "Case status",
        from: "2026-09-07T00:00:00Z",
        to: "2026-10-07T00:00:00Z",
        columns: utv
          ? ["Sapling ID", "Candidate", "Check", "Closed", "Reason", "Colour code"]
          : [
              "Sapling ID",
              "Candidate",
              "Status",
              "Initiated",
              "Completed",
              "Checks done",
              "Colour code",
            ],
        total: 1,
        colours: { AMBER: 1 },
        rows: [
          {
            cells: utv
              ? [
                  "SG-1",
                  "Aarav Sharma",
                  "Education",
                  "06 Oct 2026",
                  "University closed",
                  "Insufficient / UTV",
                ]
              : [
                  "SG-1",
                  "Aarav Sharma",
                  "Completed",
                  "01 Oct 2026",
                  "05 Oct 2026",
                  "2/2",
                  "Insufficient / UTV",
                ],
            colour: "AMBER",
          },
        ],
      });
    }
    if (path === "/client-reports/schedules" && method === "GET")
      return reply({
        items: schedules,
        recipients: [{ email: "hr@vision.test", displayName: "Priya HR" }],
      });
    if (path === "/client-reports/schedules" && method === "POST") {
      schedules.push({
        id: "22222222-2222-4222-8222-222222222222",
        ...(body as object),
        nextRunAt: "2026-10-12T02:30:00Z",
        lastRunAt: null,
        createdAt: "2026-10-07T10:00:00Z",
      });
      return reply({ id: "s-1", nextRunAt: "2026-10-12T02:30:00Z" });
    }
    return undefined;
  });
  await page.goto("/client-portal/reports?view=mis");
  await expect(page.getByRole("heading", { name: "Ready-made reports" })).toBeVisible();
  await page
    .getByRole("group", { name: "Report preset" })
    .getByRole("button", { name: /UTV/ })
    .click();
  await expect(page.getByRole("table", { name: "Unable to verify (UTV) preview" })).toBeVisible();
  await expect(page.getByText("University closed")).toBeVisible();
  await page.getByLabel("Schedule frequency").selectOption("WEEKLY");
  await page.getByRole("checkbox", { name: /Priya HR/ }).check();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect
    .poll(() => calls.find((call) => call.method === "POST")?.body)
    .toEqual({ preset: "CASE_STATUS", frequency: "WEEKLY", recipients: ["hr@vision.test"] });
  await expect(page.getByRole("list", { name: "Active schedules" })).toContainText("weekly");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("Company Admin validates a bill from its annexure", async ({ page }) => {
  await clientWorkspaceFixture(page);
  let status = "PENDING";
  const calls = await overlay(page, (path, method, _body, reply) => {
    if (path === "/client-finance/overview")
      return reply({
        summary: {
          invoiceCount: 1,
          openInvoiceCount: 1,
          billed: 1180,
          collected: 0,
          credited: 0,
          outstanding: 1180,
          overdueAmount: 0,
          overdueCount: 0,
        },
        ageing: [],
        generatedAt: "2026-10-07T10:00:00Z",
      });
    if (path.startsWith("/client-finance/invoices?"))
      return reply({
        items: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            invoiceNumber: "INV-2026-10",
            status: "ISSUED",
            currency: "INR",
            totalAmount: 1180,
            paidAmount: 0,
            creditedAmount: 0,
            balance: 1180,
            issuedAt: "2026-10-01T00:00:00Z",
            dueAt: "2026-10-31T00:00:00Z",
            annexureStatus: status,
          },
        ],
        nextCursor: null,
      });
    if (path.endsWith("/annexure") && method === "GET")
      return reply({
        invoice: {
          id: "33333333-3333-4333-8333-333333333333",
          invoiceNumber: "INV-2026-10",
          status: "ISSUED",
          issuedAt: "2026-10-01T00:00:00Z",
          clientName: "Vision India",
          subtotal: "1000.00",
          taxAmount: "180.00",
          totalAmount: "1180.00",
        },
        validation: {
          status,
          sentAt: "2026-10-02T00:00:00Z",
          validatedAt: null,
          query: null,
          ageing: true,
        },
        colours: { GREEN: 1 },
        rows: [
          {
            caseNumber: "SG-1",
            candidateName: "Aarav Sharma",
            description: "HireCheck package",
            completedAt: "2026-09-30T00:00:00Z",
            releasedAt: "2026-09-30T00:00:00Z",
            quantity: 1,
            unitPrice: "1000.00",
            taxRate: "18.00",
            lineTotal: "1000.00",
            colour: "GREEN",
            colourLabel: "Clear",
          },
        ],
      });
    if (path.endsWith("/annexure/validate")) {
      status = "VALIDATED";
      return reply({ annexureStatus: "VALIDATED" });
    }
    return undefined;
  });
  await page.goto("/client-portal/reports?view=invoices");
  await expect(page.getByText("Validate bill").first()).toBeVisible();
  await page.getByRole("button", { name: "Details for INV-2026-10" }).click();
  const panel = page.getByRole("region", { name: "Billing annexure INV-2026-10" });
  await expect(panel.getByText("Over 3 days")).toBeVisible();
  await expect(panel.getByText("Aarav Sharma")).toBeVisible();
  await panel.getByRole("button", { name: "Validate bill" }).click();
  await expect
    .poll(() => calls.some((call) => call.path.endsWith("/annexure/validate")))
    .toBe(true);
  await expect(panel.getByText("Validated", { exact: true })).toBeVisible();
});

test("Platform Admin creates a narrower custom role", async ({ page }) => {
  await onboardingFixture(page, "ADMIN");
  const roles: unknown[] = [];
  const calls = await overlay(page, (path, method, body, reply) => {
    if (path === "/roles/custom" && method === "GET")
      return reply({
        bases: [
          {
            code: "VERIFIER",
            name: "Verifier",
            permissions: ["case:read", "task:read", "task:write"],
          },
        ],
        items: roles,
      });
    if (path === "/roles/custom" && method === "POST") {
      const input = body as { name: string; baseRoleCode: string; permissions: string[] };
      roles.push({
        id: "44444444-4444-4444-8444-444444444444",
        code: "CUSTOM_VERIFIER_READ_ONLY",
        ...input,
        users: 0,
        updatedAt: "2026-10-07T10:00:00Z",
      });
      return reply({ id: "r-1", code: "CUSTOM_VERIFIER_READ_ONLY" });
    }
    return undefined;
  });
  await page.goto("/admin/roles");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  await page.getByRole("button", { name: "New role" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role name").fill("Verifier read only");
  await dialog.getByRole("checkbox", { name: "Task write" }).uncheck();
  await dialog.getByRole("button", { name: "Create role" }).click();
  await expect
    .poll(() => calls.find((call) => call.method === "POST")?.body)
    .toEqual({
      name: "Verifier read only",
      baseRoleCode: "VERIFIER",
      permissions: ["case:read", "task:read"],
    });
  await expect(page.getByText("Based on Verifier · 2 permissions · 0 users")).toBeVisible();
});

test("RM sees monthly dues and sends a payment reminder", async ({ page }) => {
  await spocFixture(page);
  let reminded = false;
  const calls = await overlay(page, (path, method, _body, reply) => {
    if (path === "/rm/payments")
      return reply({
        items: [
          {
            clientId: "55555555-5555-4555-8555-555555555555",
            clientName: "Northstar Labs",
            outstanding: 23600,
            overdue: 11800,
            unbilledReports: 3,
            lastReminderAt: reminded ? "2026-10-08T05:00:00Z" : null,
            invoices: [
              {
                id: "i-1",
                invoiceNumber: "INV-2026-09",
                status: "ISSUED",
                version: 3,
                total: 11800,
                paid: 0,
                dueAt: "2026-10-05T00:00:00Z",
                balance: 11800,
                overdue: true,
                billValidation: "VALIDATED",
              },
              {
                id: "i-2",
                invoiceNumber: "INV-2026-10",
                status: "ISSUED",
                version: 1,
                total: 11800,
                paid: 0,
                dueAt: "2026-10-31T00:00:00Z",
                balance: 11800,
                overdue: false,
                billValidation: "PENDING",
              },
            ],
          },
        ],
        totals: { outstanding: 23600, overdue: 11800, unbilledReports: 3 },
      });
    if (path === "/rm/payments/invoices/i-1/payments" && method === "POST")
      return reply({ id: "i-1", status: "PARTIALLY_PAID" });
    if (path.endsWith("/remind") && method === "POST") {
      reminded = true;
      return reply({ clientId: "c", outstanding: 23600, clientAdmins: 2 });
    }
    return undefined;
  });
  await page.goto("/spoc-rm/payments");
  await expect(page.getByRole("heading", { name: "Payments", level: 1 })).toBeVisible();
  const company = page.getByRole("listitem", { name: "Northstar Labs" });
  await expect(company.getByRole("row", { name: /INV-2026-09.*overdue/ })).toBeVisible();
  await expect(page.getByText(/3 released reports to bill/)).toBeVisible();
  await page.getByRole("button", { name: "Send payment reminder" }).click();
  await page.getByLabel("Reminder note for Northstar Labs").fill("September billing");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect
    .poll(() => calls.find((call) => call.path.endsWith("/remind"))?.body)
    .toEqual({ note: "September billing" });
  await expect(page.getByText(/last reminder/)).toBeVisible();
  // The RM records money received against an invoice of its company.
  await company.getByRole("button", { name: "Record payment for INV-2026-09" }).click();
  const dialog = page.getByRole("dialog", { name: "Record payment" });
  await dialog.getByLabel("Amount received (₹)").fill("5000");
  await expect(dialog.getByText(/Part payment · ₹6,800 will remain due/)).toBeVisible();
  await dialog.getByLabel("Method").selectOption("UPI");
  const submit = dialog.getByRole("button", { name: /Record ₹5,000/ });
  await expect(submit).toBeDisabled();
  await dialog.getByLabel(/Reference/).fill("UTR-4410023");
  await page.screenshot({ path: "test-results/rm-record-payment.png" });
  await submit.click();
  await expect(page.getByText("Payment of ₹5,000 recorded")).toBeVisible();
  await expect
    .poll(() => calls.find((call) => call.path.endsWith("/i-1/payments"))?.body)
    .toMatchObject({ amount: 5000, method: "UPI", reference: "UTR-4410023", version: 3 });
  await page.screenshot({ path: "test-results/rm-payments.png", fullPage: true });
  // Phone width, after a fresh load (toasts from the actions above are gone).
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(company).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("RM generates a company's MIS and downloads it", async ({ page }) => {
  await spocFixture(page);
  const calls = await overlay(page, (path, _method, _body, reply) => {
    if (path === "/rm/clients")
      return reply({
        items: [
          { id: "55555555-5555-4555-8555-555555555555", name: "Northstar Labs" },
          { id: "66666666-6666-4666-8666-666666666666", name: "Orbit Retail" },
        ],
      });
    if (/^\/rm\/clients\/[^/]+\/mis(\?|$)/.test(path))
      return reply({
        preset: "CASE_STATUS",
        title: "Case status",
        from: "2026-09-10",
        to: "2026-10-10",
        columns: ["Sapling ID", "Candidate", "Status", "Colour"],
        total: 1,
        colours: { GREEN: 1 },
        rows: [{ cells: ["SG-1", "Test Candidate", "Completed", "Green"], colour: "GREEN" }],
      });
    return undefined;
  });
  await page.goto("/spoc-rm/mis");
  await expect(page.getByRole("heading", { name: "Company MIS", level: 1 })).toBeVisible();
  await expect(page.getByRole("table", { name: "Case status preview" })).toBeVisible();
  await page.getByLabel("Company", { exact: true }).selectOption({ label: "Orbit Retail" });
  await expect
    .poll(() => calls.some((call) => call.path.startsWith("/rm/clients/66666666")))
    .toBe(true);
  await page.screenshot({ path: "test-results/rm-company-mis.png", fullPage: true });
});

test("Operations overrides allocation: picks checks and the verifier with room", async ({
  page,
}) => {
  await operationsOverviewFixture(page);
  const calls = await overlay(page, (path, method, _body, reply) => {
    if (path === "/tasks/bulk-assignment" && method === "POST")
      return reply({ assigned: 2, memberName: "Riya Mehta", warnings: [] });
    return undefined;
  });
  await page.goto("/operations/assignments");
  await expect(page.getByRole("heading", { name: "Override allocation", level: 1 })).toBeVisible();
  await expect(
    page.getByText("Normally the Team Leader assigns checks from the Team queue."),
  ).toBeVisible();
  const confirm = page.getByRole("button", { name: "Pick checks and a verifier" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "At risk" }).click();
  await page.getByRole("checkbox", { name: /Select .* for Ops Candidate 1/ }).check();
  await page.getByRole("checkbox", { name: /Select .* for Ops Candidate 2/ }).check();
  await page.getByRole("button", { name: /Riya Mehta/ }).click();
  await page.getByLabel("Note for the verifier").fill("Client chased twice; call HR first");
  await page.getByRole("button", { name: "Assign 2 checks to Riya Mehta" }).click();
  await expect
    .poll(() => calls.find((call) => call.path === "/tasks/bulk-assignment")?.body)
    .toMatchObject({ instructions: "Client chased twice; call HR first" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test("a person with RM + Data Entry switches role from the top bar", async ({ page }) => {
  await spocFixture(page);
  await overlay(page, (path, _method, _body, reply) => {
    if (path === "/auth/me")
      return reply({
        id: "user-rm",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Riya Mehta",
        email: "riya@example.invalid",
        roles: ["SPOC_RM", "DATA_ENTRY"],
        permissions: ["dashboard:read", "case:read", "notification:read", "clarification:write"],
        clientScope: [],
        mustChangePassword: false,
      });
    if (path.startsWith("/workflow/data-entry/queue"))
      return reply({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
        counts: { mine: 0, correction: 0 },
        generatedAt: "2026-10-08T06:00:00Z",
      });
    return undefined;
  });
  await page.goto("/spoc-rm/work");
  const switcher = page.getByRole("button", { name: "Switch role" });
  await expect(switcher).toContainText("RM / SPOC");
  await switcher.click();
  await page.getByRole("menuitem", { name: /^Data Entry/ }).click();
  await expect(page).toHaveURL(/\/data-entry/);
  await expect(page.getByRole("button", { name: "Switch role" })).toContainText("Data Entry");
});

test("Admin gives an RM the Data Entry role too; Field Executive is coming soon", async ({
  page,
}) => {
  await onboardingFixture(page, "ADMIN");
  const calls = await overlay(page, (path, method, _body, reply) => {
    if (path.startsWith("/users?") && method === "GET")
      return reply({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            displayName: "Niku",
            email: "niku@example.invalid",
            status: "ACTIVE",
            mustChangePassword: false,
            lastLoginAt: null,
            createdAt: "2026-10-01T00:00:00Z",
            version: 3,
            roles: [{ code: "SPOC_RM", name: "RM / SPOC" }],
            spocClients: [{ id: "c-1", displayName: "Vision India" }],
            teams: [],
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
        summary: { total: 1, active: 1, invited: 0, suspended: 0 },
      });
    if (path.startsWith("/users/55555555") && method === "PATCH")
      return reply({ id: "55555555-5555-4555-8555-555555555555", version: 4 });
    if (path === "/users/setup-options") return reply({ departments: [], access: [] });
    return undefined;
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Actions for Niku" }).click();
  await page.getByRole("menuitem", { name: "Edit role & access" }).click();
  const dialog = page.getByRole("dialog", { name: /Edit role & access/ });
  await expect(dialog.getByRole("button", { name: /Field Executive/ })).toBeDisabled();
  await expect(dialog.getByText("Coming soon")).toBeVisible();
  await dialog.getByRole("button", { name: /^Data Entry/ }).click();
  await expect(dialog.getByText(/Next, add them to their team/)).toBeVisible();
  const save = dialog.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Confirm combined roles" }).check();
  await save.click();
  await expect
    .poll(() => calls.find((call) => call.method === "PATCH")?.body)
    .toMatchObject({
      version: 3,
      roleCodes: ["SPOC_RM", "DATA_ENTRY"],
      additionalAccessConfirmed: true,
      spocClientIds: ["c-1"],
    });
});
