import { expect, test, type Page } from "@playwright/test";

const now = Date.now();
const iso = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

async function setupStep3Verifier(page: Page) {
  const requests: Array<{ method: string; path: string; body?: unknown }> = [];
  const task = {
    id: "t-step3",
    status: "IN_PROGRESS",
    version: 1,
    dueAt: iso(12),
    instructions: null,
    completedAt: null,
    blockerReason: null,
    check: {
      publicId: "chk-step3",
      type: "EMPLOYMENT",
      status: "IN_PROGRESS",
      department: { name: "Employment", teamType: "EMPLOYMENT" },
      result: null,
      findings: [],
      case: {
        publicId: "case-step3",
        caseNumber: "SG-2026-STEP3",
        priority: "NORMAL",
        subject: { publicId: "sub-step3", fullName: "Meera Iyer" },
        client: { publicId: "client-1", displayName: "Horizon Tech" },
      },
    },
  };

  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const method = req.method();
    const body = req.postData() ? (JSON.parse(req.postData()!) as unknown) : undefined;
    requests.push({ method, path, body });
    const reply = (json: unknown) => route.fulfill({ json });

    if (path === "/auth/me")
      return reply({
        id: "v-1",
        tenantId: "t-1",
        tenantName: "Sapling Global",
        displayName: "Priya Das",
        email: "priya@example.invalid",
        roles: ["VERIFIER"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/tasks/mine/insights")
      return reply({
        summary: {
          active: 1,
          open: 0,
          inProgress: 1,
          blocked: 0,
          overdue: 0,
          dueToday: 0,
          dueNext24h: 1,
          completedToday: 0,
          completedThisWeek: 0,
          totalCompleted: 0,
          averageTurnaroundMinutes: 0,
          slaSampleSize: 0,
          slaHitRate: null,
        },
        outcomes: { clear: 0, discrepancy: 0, unableToVerify: 0 },
        daily: [],
      });
    if (path === "/tasks/mine")
      return reply({
        items: [task],
        nextCursor: null,
        summary: { active: 1, overdue: 0, blocked: 0, completedToday: 0 },
      });
    if (path === "/tasks/t-step3/context")
      return reply({
        publicId: task.id,
        createdAt: iso(-5),
        check: {
          ...task.check,
          case: {
            ...task.check.case,
            documents: [],
            consents: [],
            clarifications: [],
            statusHistory: [],
          },
        },
      });
    if (path === "/checks/chk-step3/verified-details")
      return reply({
        checkId: "chk-step3",
        type: "EMPLOYMENT",
        statusLabel: "In progress",
        lhs: { form: { repeatable: false, fields: [] }, entries: [] },
        rhs: {
          form: {
            repeatable: true,
            fields: [{ key: "employerName", label: "Employer name", required: true }],
          },
          entries: [{ employerName: "Acme Solutions" }],
          verifiedAt: iso(-1),
        },
      });
    if (path === "/checks/chk-step3/evidence")
      return reply({
        checkId: "chk-step3",
        items: [
          {
            id: "ev-1",
            name: "hr-reply.png",
            contentType: "image/png",
            sizeBytes: 2048,
            caption: "HR email reply",
            uploadedAt: iso(-1),
            uploadedBy: "Priya Das",
          },
        ],
      });
    if (path === "/workflow/colour-matrix")
      return reply({
        matrix: {
          EMPLOYMENT: [
            { id: "emp-1", text: "All details verified", colour: "GREEN" },
            { id: "emp-5", text: "Period of employment differs", colour: "YELLOW" },
          ],
        },
        colourNames: { GREEN: "Green", YELLOW: "Yellow", AMBER: "Orange", RED: "Red" },
        resultFor: { GREEN: "CLEAR", YELLOW: "DISCREPANCY" },
      });
    if (path === "/checks/chk-step3/vendor")
      return reply({
        checkId: "chk-step3",
        checkType: "EMPLOYMENT",
        canManage: false,
        attempts: [],
      });
    if (path === "/tasks/t-step3" && method === "PATCH")
      return reply({
        id: "t-step3",
        status: "COMPLETED",
        version: 2,
        tlReview: false,
        canForward: false,
      });
    return reply({});
  });

  return { requests };
}

test("Step 3 source summary <20, =20 and >20 chars never auto-advances; manual navigation & submit work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { requests } = await setupStep3Verifier(page);
  await page.goto("/verifier/queue?taskId=t-step3");

  const steps = page.getByRole("navigation", { name: "Steps to complete this check" });
  const step3Btn = steps.getByRole("button", { name: /Outcome & summary/ });
  const step4Btn = steps.getByRole("button", { name: /Review & complete/ });
  const summary = page.getByPlaceholder("Source, verification method, dates and response received");
  const completeBtn = page.getByRole("button", { name: "Complete check" });

  await expect(step3Btn).toHaveAttribute("aria-current", "step");
  await expect(steps.getByText("2 of 4 done")).toBeVisible();

  // 1. Below 20 characters -> remains on Step 3, Complete check stays disabled
  await summary.fill("1234567890123456789");
  await expect(page.getByText("19/20 characters minimum")).toBeVisible();
  await expect(step3Btn).toHaveAttribute("aria-current", "step");
  await expect(step4Btn).not.toHaveAttribute("aria-current", "step");
  await expect(completeBtn).toBeDisabled();

  // 2. Exactly 20 characters -> marks step done & enables completion, STILL stays on Step 3
  await summary.fill("12345678901234567890");
  await expect(page.getByText("20/20 characters minimum")).toBeVisible();
  await expect(steps.getByText("3 of 4 done")).toBeVisible();
  await expect(step3Btn).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("list", { name: "Before you complete" })).toHaveCount(0);
  await expect(completeBtn).toBeEnabled();

  // 3. Above 20 characters + matrix outcome change -> STILL stays on Step 3
  await page.getByLabel("What did you find").selectOption({ label: "All details verified" });
  const finalSummary = "HR confirmed employment tenure and role by email on 10 Nov.";
  await summary.fill(finalSummary);
  await expect(step3Btn).toHaveAttribute("aria-current", "step");
  await expect(summary).toHaveValue(finalSummary);

  // 4. Explicit Next step navigates to Step 4; Back returns to Step 3; Review & complete returns to Step 4
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(step4Btn).toHaveAttribute("aria-current", "step");
  await expect(page.getByRole("list", { name: "Before you complete" })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(step3Btn).toHaveAttribute("aria-current", "step");
  await expect(summary).toHaveValue(finalSummary);

  await step4Btn.click();
  await expect(step4Btn).toHaveAttribute("aria-current", "step");

  // 5. Final submission submits full summary from Step 4
  await completeBtn.click();
  await expect(page.getByText("Check completed and sent forward")).toBeVisible();
  const patch = requests.find((r) => r.method === "PATCH" && r.path === "/tasks/t-step3");
  expect(patch?.body).toMatchObject({ status: "COMPLETED", sourceSummary: finalSummary });
});
