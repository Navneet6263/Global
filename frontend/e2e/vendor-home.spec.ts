import { expect as baseExpect, test, type Page, type Route } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20_000 });

const now = "2026-11-17T06:00:00Z";

function job(id: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    attempt: 1,
    status,
    checkId: `check-${id}`,
    checkType: "ADDRESS",
    caseId: "case-1",
    caseNumber: `SG-${id.slice(0, 4).toUpperCase()}`,
    candidateName: "Aarav Sharma",
    clientName: "Vision India",
    vendor: { id: "vendor-1", name: "Field Co" },
    handler: null,
    assignedBy: "Riya Mehta",
    reviewedBy: null,
    note: null,
    dueAt: "2026-11-30T12:30:00Z",
    assignedAt: now,
    acceptedAt: now,
    submittedAt: null,
    reviewedAt: null,
    result: null,
    remarks: null,
    declineReason: null,
    reviewNote: null,
    assignedAs: "RM",
    requestReason: null,
    approval: null,
    evidenceCount: 0,
    price: 450,
    city: "Lucknow",
    pincode: "226010",
    pickedAt: now,
    releaseCount: 0,
    fromQueue: true,
    teamReview: null,
    extraCosts: [],
    version: 2,
    ageDays: 1,
    ageing: "0-2",
    overdue: false,
    ...extra,
  };
}

const RETURNED = "11111111-1111-4111-8111-111111111111";
const NEW = "22222222-2222-4222-8222-222222222222";
const REVIEW = "33333333-3333-4333-8333-333333333333";

const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, json: data });

/** A Main Vendor with returned, new and team-review work, an open queue and earnings. */
async function vendorHomeFixture(page: Page) {
  const months: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/me")
      return json(route, {
        id: "vendor-1",
        tenantId: "tenant-1",
        tenantName: "Sapling Global",
        displayName: "Field Co",
        email: "field@vendor.test",
        roles: ["VENDOR"],
        permissions: ["vendor:review", "notification:read"],
        mustChangePassword: false,
        vendorStatus: "APPROVED",
      });
    if (path === "/auth/refresh") return json(route, { message: "Unauthorized" }, 401);
    if (path === "/notifications") return json(route, { items: [], unreadCount: 0 });
    if (path === "/vendor/checks/earnings") {
      const month = url.searchParams.get("month") ?? "";
      months.push(month);
      const empty = month !== "2026-11";
      return json(route, {
        month,
        items: empty
          ? []
          : [
              {
                id: "earn-1",
                caseNumber: "SG-PAID-1",
                checkType: "COURT_RECORD",
                city: "Pune",
                pincode: "411001",
                handledBy: "Ravi Kumar",
                acceptedAt: "2026-11-10T06:00:00Z",
                fromQueue: true,
                rateToConfirm: false,
                payment: 300,
                extra: 200,
                total: 500,
              },
              {
                id: "earn-2",
                caseNumber: "SG-PAID-2",
                checkType: "ADDRESS",
                city: "Lucknow",
                pincode: null,
                handledBy: null,
                acceptedAt: "2026-11-12T06:00:00Z",
                fromQueue: false,
                rateToConfirm: true,
                payment: 0,
                extra: 0,
                total: 0,
              },
            ],
        totals: empty
          ? { checks: 0, payment: 0, extra: 0, total: 0, rateToConfirm: 0 }
          : { checks: 2, payment: 300, extra: 200, total: 500, rateToConfirm: 1 },
        inReview: { checks: 1, value: 450 },
      });
    }
    if (path === "/vendor/checks")
      return json(route, {
        summary: {
          counts: { RETURNED: 1, ASSIGNED: 1, TEAM_REVIEW: 1, APPROVED: 2 },
          ageing: { "0-2": 3, "3-5": 0, "6-10": 0, "10+": 0 },
          overdue: 0,
        },
        items: [
          job(NEW, "ASSIGNED", { pickedAt: null, fromQueue: false }),
          job(REVIEW, "TEAM_REVIEW", { handler: { id: "member-1", name: "Ravi Kumar" } }),
          job(RETURNED, "RETURNED", { reviewNote: "Photo is blurred" }),
          job("44444444-4444-4444-8444-444444444444", "APPROVED"),
        ],
      });
    if (path === "/vendor/queue")
      return json(route, {
        items: [
          {
            id: "q-1",
            version: 1,
            checkType: "CRIMINAL",
            price: 350,
            city: "Jaipur",
            pincode: "302001",
            dueAt: "2026-11-28T12:30:00Z",
            postedAt: now,
            instructions: null,
            returnedTimes: 0,
            documents: [],
          },
        ],
        summary: { count: 1, value: 350 },
      });
    if (path === "/vendor/requests")
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 1,
        counts: { pending: 2, approved: 5, rejected: 1 },
      });
    if (route.request().method() === "GET") return json(route, { items: [], total: 0, counts: {} });
    return json(route, { title: `Unmocked ${path}` }, 404);
  });
  return { months };
}

test("the vendor Home lists what needs doing first, the queue and this month's money", async ({
  page,
}) => {
  await vendorHomeFixture(page);
  await page.clock.setFixedTime(new Date(now));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vendor");
  await expect(page.getByRole("heading", { name: /Field/, level: 1 })).toBeVisible();

  const glance = page.getByRole("region", { name: "Your work at a glance" });
  await expect(glance.getByText("New to accept")).toBeVisible();
  await expect(glance.getByText("₹500.00")).toBeVisible();

  // Most urgent first: sent back, then new work, then the member's work to review.
  const rows = page.getByRole("list", { name: "Needs you now" }).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Sent back: fix and resubmit");
  await expect(rows.nth(1)).toContainText("New: accept or decline");
  await expect(rows.nth(2)).toContainText("Review your team member's work");
  await expect(rows.nth(2)).toContainText("With Ravi Kumar");

  await expect(page.getByText("Jaipur · 302001")).toBeVisible();
  await expect(page.getByRole("link", { name: /Pending\s*2/ })).toHaveAttribute(
    "href",
    "/vendor/pending",
  );
  // Menu: work first, then payments.
  await expect(page.getByRole("link", { name: "Earnings" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/vendor-home.png", fullPage: true });

  // A row opens that check in My checks.
  await rows.nth(0).click();
  await expect(page).toHaveURL(new RegExp(`/vendor/checks\\?job=${RETURNED}$`));
});

test("Earnings shows each accepted check with payment, extra cost and the month total", async ({
  page,
}) => {
  const { months } = await vendorHomeFixture(page);
  await page.clock.setFixedTime(new Date(now));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vendor/earnings");
  await expect(page.getByRole("heading", { name: "Earnings", level: 1 })).toBeVisible();
  await expect(page.getByText("November 2026", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();

  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Court record/ })).toContainText("₹500.00");
  await expect(table.getByRole("row", { name: /SG-PAID-2/ })).toContainText("To confirm");
  await expect(table.getByRole("row", { name: /Total for November 2026/ })).toContainText(
    "₹500.00",
  );
  await expect(page.getByText(/1 check was sent to you directly/)).toBeVisible();
  await page.screenshot({ path: "test-results/vendor-earnings.png", fullPage: true });

  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByText("October 2026", { exact: true })).toBeVisible();
  await expect(page.getByText("No accepted checks this month")).toBeVisible();
  expect(months).toContain("2026-10");
});

test("vendor Home and Earnings fit a phone without sideways scrolling", async ({ page }) => {
  await vendorHomeFixture(page);
  await page.clock.setFixedTime(new Date(now));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/vendor", "/vendor/earnings"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
