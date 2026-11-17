import { expect as baseExpect, test, type Page, type Route } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

const now = "2026-11-17T06:00:00Z";
const JOB = "66666666-6666-4666-8666-666666666666";
const CHECK = "77777777-7777-4777-8777-777777777777";
const COST = "99999999-9999-4999-8999-999999999999";

const addressForm = {
  repeatable: true,
  fields: [{ key: "respondentName", label: "Respondent name", required: true }],
};

function job(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: JOB,
    attempt: 1,
    status,
    checkId: CHECK,
    checkType: "ADDRESS",
    caseId: "case-1",
    caseNumber: "SG-QUEUE-1",
    candidateName: "Aarav Sharma",
    clientName: "Vision India",
    vendor: { id: "vendor-1", name: "Field Co" },
    handler: null,
    assignedBy: "Riya Mehta",
    reviewedBy: null,
    note: "Visit between 10 and 6",
    dueAt: "2026-11-25T12:30:00Z",
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

const json = (route: Route, data: unknown, status = 200) => route.fulfill({ status, json: data });
const body = (route: Route) => {
  const text = route.request().postData();
  return text ? (JSON.parse(text) as unknown) : undefined;
};

/** An approved vendor login with one queued check and its own picked check. */
async function vendorFixture(page: Page) {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let picked = false;
  let state = job("IN_PROGRESS");
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    if (method !== "GET") calls.push({ method, path, body: body(route) });
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
    if (path === "/vendor/queue")
      return json(route, {
        items: picked
          ? []
          : [
              {
                id: JOB,
                version: 1,
                checkType: "ADDRESS",
                price: 450,
                city: "Lucknow",
                pincode: "226010",
                dueAt: "2026-11-25T12:30:00Z",
                postedAt: now,
                instructions: "Visit between 10 and 6",
                returnedTimes: 1,
                documents: ["ADDRESS_PROOF"],
              },
            ],
        summary: { count: picked ? 0 : 1, value: picked ? 0 : 450 },
      });
    if (path === `/vendor/queue/${JOB}/pick`) {
      picked = true;
      return json(route, { id: JOB, version: 2 });
    }
    if (path === "/vendor/checks")
      return json(route, {
        summary: {
          counts: { [state.status]: 1 },
          ageing: { "0-2": 1, "3-5": 0, "6-10": 0, "10+": 0 },
          overdue: 0,
        },
        items: picked ? [state] : [],
      });
    if (path === `/vendor/checks/${JOB}`)
      return json(route, {
        ...state,
        canDelegate: true,
        canRelease: state.status === "IN_PROGRESS" && state.evidenceCount === 0,
        canTeamReview: false,
        canAddCost: state.status === "IN_PROGRESS",
        team: [],
        lhs: { form: null, entries: [] },
        rhsForm: addressForm,
        results: ["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"],
        submission: [],
        documents: [],
        evidence: [],
      });
    if (path === `/vendor/checks/${JOB}/extra-costs`) {
      const input = body(route) as { amount: number; reason: string };
      state = {
        ...state,
        version: state.version,
        extraCosts: [
          {
            id: COST,
            amount: input.amount,
            reason: input.reason,
            status: "PENDING",
            addedBy: "Field Co",
            addedAt: now,
            decidedBy: null,
            decidedAt: null,
            note: null,
          },
        ],
      } as typeof state;
      return json(route, state.extraCosts[0]);
    }
    if (path === `/vendor/checks/${JOB}/release`) {
      picked = false;
      return json(route, { version: 3 });
    }
    if (method === "GET") return json(route, { items: [], total: 0, counts: {} });
    return json(route, { title: `Unmocked ${path}` }, 404);
  });
  return { calls, pick: () => (picked = true) };
}

test("a vendor sees the open queue with payment and city, and picks a check", async ({ page }) => {
  const { calls } = await vendorFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/vendor/queue");
  await expect(page.getByRole("heading", { name: "Open queue", level: 1 })).toBeVisible();
  const card = page.getByRole("list", { name: "Open checks" }).getByRole("listitem");
  await expect(card.getByText("Lucknow · 226010")).toBeVisible();
  await expect(card.getByText("450")).toBeVisible();
  await expect(card.getByText(/Documents shared: Address proof/)).toBeVisible();
  await expect(card.getByText("Returned by a vendor 1 time")).toBeVisible();
  // The candidate is never shown before picking.
  await expect(page.getByText("Aarav Sharma")).toHaveCount(0);
  await page.screenshot({ path: "test-results/vendor-open-queue.png" });
  await card.getByRole("button", { name: /Pick address check in Lucknow/i }).click();
  await expect(page).toHaveURL(/\/vendor\/checks$/);
  expect(calls.find((call) => call.path.endsWith("/pick"))?.body).toEqual({ version: 1 });
  await expect(page.getByText("SG-QUEUE-1")).toBeVisible();
});

test("a picked check takes an extra cost and can go back to the queue", async ({ page }) => {
  const fixture = await vendorFixture(page);
  fixture.pick();
  await page.goto("/vendor/checks");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/From the open queue · payment ₹450/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add extra cost" }).click();
  await dialog.getByLabel("Extra cost amount").fill("300");
  await dialog.getByLabel("Why the extra cost was needed").fill("Travelled 40 km outside the city");
  await dialog.getByRole("button", { name: "Add extra cost" }).click();
  await expect
    .poll(() => fixture.calls.find((call) => call.path.endsWith("/extra-costs"))?.body)
    .toEqual({ amount: 300, reason: "Travelled 40 km outside the city" });
  await expect(dialog.getByText("Waiting for RM")).toBeVisible();
  await dialog.getByRole("button", { name: "Return to the queue" }).click();
  await dialog
    .getByLabel("Reason for returning it")
    .fill("The address is outside our service area");
  await dialog.getByRole("button", { name: "Return to the queue" }).click();
  await expect
    .poll(() => fixture.calls.find((call) => call.path.endsWith("/release"))?.body)
    .toEqual({ version: 2, reason: "The address is outside our service area" });
});

function internalState(extra: Record<string, unknown> = {}) {
  return {
    checkId: CHECK,
    checkType: "ADDRESS",
    canManage: true,
    assignAs: "RM",
    needsApproval: false,
    canAssign: true,
    vendors: [{ id: "vendor-1", name: "Field Co" }],
    documents: [{ id: "doc-1", type: "ADDRESS_PROOF", name: "bill.pdf", suggested: true }],
    rhsForm: addressForm,
    queueRate: 450,
    queueLocation: { city: "Lucknow", pincode: "226010" },
    attempts: [],
    ...extra,
  };
}

async function internalFixture(page: Page, state: () => Record<string, unknown>) {
  await operationsOverviewFixture(page);
  const calls: Array<{ path: string; body?: unknown }> = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    if (method !== "GET") calls.push({ path, body: body(route) });
    if (path === "/vendor-checks")
      return json(route, {
        summary: { counts: {}, ageing: { "0-2": 1, "3-5": 0, "6-10": 0, "10+": 0 }, overdue: 0 },
        items: [job("SUBMITTED")],
      });
    if (path === `/checks/${CHECK}/vendor`) {
      if (method === "POST") return json(route, { id: JOB, attempt: 1, status: "OPEN" });
      return json(route, state());
    }
    if (path.includes("/extra-costs/") && path.endsWith("/decision"))
      return json(route, { id: COST, status: "APPROVED" });
    if (path === "/vendor-rates") {
      if (method === "GET")
        return json(route, {
          items: [
            {
              checkType: "ADDRESS",
              price: 450,
              version: 2,
              updatedAt: now,
              updatedBy: "Ops Lead",
            },
            {
              checkType: "COURT_RECORD",
              price: null,
              version: 0,
              updatedAt: null,
              updatedBy: null,
            },
          ],
        });
    }
    if (path.startsWith("/vendor-rates/"))
      return json(route, { checkType: "COURT_RECORD", price: 300, version: 1, updatedAt: now });
    return route.fallback();
  });
  return calls;
}

test("the RM posts a check to the open queue with the payment and sees what vendors see", async ({
  page,
}) => {
  const calls = await internalFixture(page, () => internalState());
  await page.goto("/operations/vendor-work");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Vendor", { exact: true })
    .selectOption({ label: "Open queue (all approved vendors)" });
  await expect(dialog.getByLabel("Payment to the vendor")).toHaveValue("450");
  await expect(dialog.getByText("Lucknow · 226010")).toBeVisible();
  await dialog.getByLabel("Payment to the vendor").fill("500");
  await dialog.getByRole("button", { name: "Post to the open queue" }).click();
  await expect
    .poll(() => calls.find((call) => call.path === `/checks/${CHECK}/vendor`)?.body)
    .toEqual({ toQueue: true, price: 500, documentIds: ["doc-1"] });
});

test("the RM approves the vendor's extra cost before accepting the result", async ({ page }) => {
  const cost = {
    id: COST,
    amount: 300,
    reason: "Travelled 40 km outside the city",
    status: "PENDING",
    addedBy: "Ravi (field)",
    addedAt: now,
    decidedBy: null,
    decidedAt: null,
    note: null,
  };
  const calls = await internalFixture(page, () =>
    internalState({
      canAssign: false,
      attempts: [
        {
          ...job("SUBMITTED", {
            result: "CLEAR",
            submittedAt: now,
            extraCosts: [cost],
            teamReview: { by: "Field Co", at: now },
          }),
          canApprove: false,
          canReview: true,
          canCancel: true,
          canDecideCosts: true,
          submission: [{ respondentName: "Neighbour" }],
          evidence: [],
        },
      ],
    }),
  );
  await page.goto("/operations/vendor-work");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Checked by the vendor's Team Leader \(Field Co\)/)).toBeVisible();
  await expect(dialog.getByText("Travelled 40 km outside the city")).toBeVisible();
  await page.screenshot({ path: "test-results/vendor-extra-cost-rm.png" });
  await dialog.getByRole("button", { name: /Approve extra cost/ }).click();
  await expect
    .poll(() => calls.find((call) => call.path.endsWith("/decision"))?.body)
    .toEqual({ decision: "APPROVE" });
});

test("Operations sets the open-queue payment for a check type", async ({ page }) => {
  const calls = await internalFixture(page, () => internalState());
  await page.goto("/operations/vendor-rates");
  await expect(page.getByRole("heading", { name: "Vendor rates", level: 1 })).toBeVisible();
  await expect(page.getByText("Not set")).toBeVisible();
  await page.getByLabel("Court record rate").fill("300");
  await page.getByRole("button", { name: "Save" }).nth(1).click();
  await expect
    .poll(() => calls.find((call) => call.path.startsWith("/vendor-rates/"))?.body)
    .toEqual({ price: 300, version: 0 });
});
