import { expect as baseExpect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 20_000 });
async function fixture(page: Page, readOnly = false) {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const unexpected: string[] = [];
  const row = {
    id: "physical-case",
    caseNumber: "PHYSICAL-TEST-1",
    status: "QA_REVIEW",
    version: 1,
    priority: "NORMAL",
    createdAt: "2026-09-09T10:00:00Z",
    updatedAt: "2026-09-09T10:00:00Z",
    subject: { publicId: "subject-test", fullName: "Physical Test Candidate" },
    client: { publicId: "client-test", code: "TEST", displayName: "Test Organisation" },
    checks: [
      {
        publicId: "check-test",
        type: "ADDRESS",
        status: "COMPLETED",
        result: "CLEAR",
        version: 1,
        tasks: [],
      },
    ],
    documents: [],
    consents: [],
    clarifications: [],
    qaReviews: [],
    reports: [],
    services: [],
    statusHistory: [],
    fieldVisits: [] as {
      publicId: string;
      status: string;
      address: string;
      version: number;
      geofenceMeters: number;
      createdAt: string;
      assignee: { publicId: string; displayName: string; email: string };
    }[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "operator-test",
        tenantId: "tenant-test",
        tenantName: "Test Workspace",
        displayName: "Test Operator",
        email: "operator@example.invalid",
        roles: ["OPS_MANAGER"],
        permissions: readOnly ? ["case:read"] : ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], nextCursor: null, unreadCount: 0 });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: new Date().toISOString() });
    if (path === "/cases/physical-case") return reply(row);
    if (path === "/cases/physical-case/reports") return reply({ items: [] });
    if (path === "/cases/physical-case/evidence-readiness")
      return reply({
        ready: false,
        issues: ["Physical address verification required"],
        requiredTypes: [],
      });
    if (path === "/cases/physical-case/field-assignees")
      return reply({
        items: [
          { id: "field-test", displayName: "Test Field Executive", email: "field@example.invalid" },
        ],
        total: 1,
      });
    if (path === "/cases/physical-case/status" && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      row.status = "IN_PROGRESS";
      row.version += 1;
      return reply(row);
    }
    if (path === "/cases/physical-case/field-visits" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      row.fieldVisits.push({
        publicId: "visit-test",
        status: "ASSIGNED",
        address: body.address,
        version: 1,
        geofenceMeters: 150,
        createdAt: "2026-09-10T10:00:00Z",
        assignee: {
          publicId: "field-test",
          displayName: "Test Field Executive",
          email: "field@example.invalid",
        },
      });
      return reply({ id: "visit-test", status: "ASSIGNED", version: 1 });
    }
    if (path === "/field-visits/visit-test/exception") {
      const body = route.request().postDataJSON();
      writes.push({ path, body });
      row.fieldVisits[0]!.status = "COMPLETED";
      row.status = "QA_REVIEW";
      return reply({ id: "visit-test", status: "COMPLETED", version: 3 });
    }
    unexpected.push(path);
    return reply({ detail: `Unexpected request ${path}` }, 500);
  });
  return { row, writes, unexpected };
}

test("Operations recovers legacy physical case and assigns the visit with explicit coordinates", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/cases/physical-case");
  await expect(
    page.getByRole("heading", { name: "Physical visit assignment required" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return for field work" }).click();
  await expect(page.getByRole("button", { name: "Assign field visit", exact: true })).toBeVisible();
  expect(state.writes[0]?.body).toMatchObject({ status: "IN_PROGRESS", version: 1 });
  await page.getByPlaceholder("Complete visit address").fill("Test Candidate Address, Noida");
  await page.getByRole("combobox", { name: "Field executive assignee" }).selectOption("field-test");
  await expect(
    page.getByRole("button", { name: "Assign field visit", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Target latitude" }).fill("28.5355");
  await page.getByRole("textbox", { name: "Target longitude" }).fill("77.3910");
  await page.getByRole("button", { name: "Assign field visit", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Field work pending" })).toBeVisible();
  expect(state.writes[1]?.body).toMatchObject({
    assigneeId: "field-test",
    latitude: 28.5355,
    longitude: 77.391,
  });
  state.row.fieldVisits[0]!.status = "REVIEW_PENDING";
  await page.reload();
  await page.getByRole("button", { name: "View field visits", exact: true }).click();
  await page.getByRole("button", { name: "Approve field evidence", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Physical visit approved" })).toBeVisible();
  expect(state.writes[2]?.body).toMatchObject({ decision: "APPROVE" });
  expect(state.unexpected).toEqual([]);
});

test("read-only access can see the physical requirement but cannot return a case or assign field work", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/cases/physical-case");
  await expect(
    page.getByRole("heading", { name: "Physical visit assignment required" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Return for field work" })).toHaveCount(0);
  await page.getByRole("button", { name: "View field visits", exact: true }).click();
  await expect(page.getByRole("button", { name: "Assign field visit", exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
  expect(state.unexpected).toEqual([]);
});
