import { expect as baseExpect, test } from "@playwright/test";
import { spocFixture } from "./fixtures/spoc-fixture";
import { PIXEL_PNG, sampleReportView } from "./fixtures/report-view";
const expect = baseExpect.configure({ timeout: 20_000 });

test("RM sidebar shows the work steps and what needs attention, with counts", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await spocFixture(page);
  await page.goto("/spoc-rm/clients");
  const nav = page.getByRole("navigation", { name: "spoc-rm navigation" });
  await expect(nav.getByText("Needs attention")).toBeVisible();
  await expect(nav.getByRole("link", { name: /Escalations\s*2/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Overdue cases\s*4/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Final reviews\s*3/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: "My clients" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.screenshot({ path: "test-results/rm-clients.png", fullPage: true });
});

for (const [path, name] of [
  ["/spoc-rm", "rm-monitoring"],
  ["/spoc-rm/records", "rm-records"],
] as const) {
  test(`${path} renders cleanly`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await spocFixture(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
  });
}

test("RM opens a completed case, sees the full report with proof and regenerates its PDF", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await spocFixture(page);
  const caseId = "77777777-7777-4777-8777-777777777777";
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let version = 1;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (!path.includes(caseId) && !path.startsWith("/checks/")) return route.fallback();
    calls.push({ method: request.method(), path, body: request.postDataJSON() as unknown });
    if (path === `/spoc/cases/${caseId}`)
      return route.fulfill({
        json: {
          id: caseId,
          caseNumber: "SG-20261010-F240BA",
          externalRef: "ABC-1234",
          status: "COMPLETED",
          holderRole: "OPS_MANAGER",
          currentOwner: null,
          priority: "NORMAL",
          riskLevel: "LOW",
          dueAt: "2026-10-13T00:00:00Z",
          createdAt: "2026-10-10T05:00:00Z",
          updatedAt: "2026-10-10T09:13:00Z",
          completedAt: "2026-10-10T09:13:00Z",
          qaClaimedAt: null,
          candidateName: "Spoken Test",
          client: { id: "client-1", displayName: "Talent", status: "ACTIVE" },
          branch: null,
          opsOwner: "Niku",
          qaReviewer: null,
          checks: [
            {
              id: "chk-final",
              type: "EMPLOYMENT",
              status: "COMPLETED",
              result: "CLEAR",
              riskLevel: null,
              dueAt: "2026-10-12T00:00:00Z",
              completedAt: "2026-10-10T08:00:00Z",
              sourceSummary: "HR confirmed tenure and designation by email.",
              tasks: [],
              findings: [],
            },
          ],
          fieldVisits: [],
          documents: [],
          clarifications: [],
          qaReviews: [],
          reports: [
            {
              id: "report-1",
              status: "PUBLISHED",
              currentVersion: version,
              publishedAt: "2026-10-10T09:13:30Z",
              createdAt: "2026-10-10T09:13:24Z",
              releasedAt: "2026-10-10T09:13:30Z",
              downloadExpiresAt: "2026-11-09T09:13:30Z",
              latest: {
                version,
                generatedAt: "2026-10-10T09:13:26Z",
                authenticityCode: version === 1 ? "SG-7E3B0CF553D3" : "SG-NEWCODE00002",
              },
              canDownload: true,
              canRegenerate: true,
            },
          ],
          invoices: [],
          statusHistory: [],
        },
      });
    if (path === `/cases/${caseId}/reports/report-1/regenerate`) {
      version = 2;
      return route.fulfill({
        json: {
          id: "report-1",
          status: "PUBLISHED",
          version: 2,
          authenticityCode: "SG-NEWCODE00002",
        },
      });
    }
    if (path === `/cases/${caseId}/reports/report-1/pdf`)
      return route.fulfill({
        contentType: "application/pdf",
        body: Buffer.from("%PDF-1.4\n%%EOF\n"),
      });
    if (path === `/cases/${caseId}/report-view`)
      return route.fulfill({
        json: sampleReportView("client", {
          caseNumber: "SG-20261010-F240BA",
          candidateName: "Spoken Test",
          checkId: "chk-final",
        }),
      });
    if (path === "/checks/chk-final/evidence/proof-1")
      return route.fulfill({ contentType: "image/png", body: PIXEL_PNG });
    return route.fallback();
  });
  await page.goto(`/spoc-rm/records?caseId=${caseId}`);
  const panel = page.getByRole("dialog", { name: /Spoken Test/ });
  const report = panel.getByRole("region", { name: "Final report" });
  await expect(report.getByText("Final report · version 1")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/rm-case-overview.png" });
  const download = page.waitForEvent("download");
  await report.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("Sapling-Global-SG-20261010-F240BA.pdf");

  await report.getByRole("button", { name: "Regenerate PDF" }).click();
  const dialog = page.getByRole("dialog", { name: "Regenerate report PDF" });
  const confirm = dialog.getByRole("button", { name: "Regenerate" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/Reason/).fill("The released PDF is missing from storage");
  await confirm.click();
  await expect(page.getByText("Report regenerated · version 2")).toBeVisible();
  expect(calls.find((call) => call.path.endsWith("/regenerate"))?.body).toEqual({
    reason: "The released PDF is missing from storage",
  });
  await expect(report.getByText("Final report · version 2")).toBeVisible();

  await panel.getByRole("button", { name: "Full report" }).click();
  await expect(panel.getByRole("region", { name: "Executive summary" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /Open proof Email response/ })).toBeVisible();
  await page.screenshot({ path: "test-results/rm-case-full-report.png" });
});

const NORTHSTAR_PROFILE = {
  company: {
    id: "c-1",
    code: "NSL",
    legalName: "Northstar Labs Private Limited",
    name: "Northstar Labs",
    status: "ACTIVE",
    contactName: "Kavya Rao",
    contactEmail: "kavya@northstar.example",
    contactPhone: "+919876543210",
    gstin: "29ABCDE1234F1Z5",
    billingAddress: "Bengaluru",
    slaHours: 72,
    createdAt: "2026-10-01T00:00:00Z",
    source: "ADDED_BY_SAPLING",
    rm: { name: "Riya Mehta", since: "2026-10-02T00:00:00Z" },
  },
  numbers: { openCases: 16, overdueCases: 2, completedCases: 6 },
  packages: {
    agreement: false,
    items: [
      { id: "p-1", name: "Standard Employee", price: 2500, discountPercent: 10 },
      { id: "p-2", name: "Executive", price: 6000, discountPercent: 0 },
    ],
  },
  users: [
    {
      id: "u-kavya",
      displayName: "Kavya Rao",
      email: "kavya@northstar.example",
      phone: null,
      status: "ACTIVE",
      mustChangePassword: false,
      lastLoginAt: "2026-10-20T05:00:00Z",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ],
};

async function clientProfileFixture(page: import("@playwright/test").Page) {
  await spocFixture(page);
  const resets: unknown[] = [];
  await page.route("**/api/v1/rm/clients/c-1/profile", (route) =>
    route.fulfill({ json: NORTHSTAR_PROFILE }),
  );
  await page.route("**/api/v1/rm/clients/c-1/mis?*", (route) =>
    route.fulfill({
      json: {
        company: { id: "c-1", name: "Northstar Labs" },
        preset: "CASE_STATUS",
        title: "Case status",
        from: "2026-09-27",
        to: "2026-10-27",
        columns: ["Case", "Candidate", "Status"],
        total: 1,
        colours: { GREEN: 1 },
        rows: [{ cells: ["SG-1", "Asha", "Completed"], colour: "GREEN" }],
      },
    }),
  );
  await page.route("**/api/v1/rm/clients/c-1/users/u-kavya/reset-password", (route) => {
    resets.push(route.request().postDataJSON());
    return route.fulfill({ json: { reset: true, emailed: true } });
  });
  return { resets };
}

test("RM opens a client's full profile from My clients", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clientProfileFixture(page);
  await page.goto("/spoc-rm/clients");
  await page.getByRole("button", { name: "Open profile of Northstar Labs" }).click();
  await expect(page).toHaveURL(/\/spoc-rm\/clients\/c-1$/);
  await expect(page.getByRole("heading", { name: "Northstar Labs", level: 1 })).toBeVisible();
  await expect(page.getByText("Northstar Labs Private Limited").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Company details" })).toContainText(
    "29ABCDE1234F1Z5",
  );
  await page.screenshot({ path: "test-results/rm-client-profile.png", fullPage: true });

  const sections = page.getByRole("navigation", { name: "Client sections" });
  await sections.getByRole("button", { name: "Cases" }).click();
  await expect(page).toHaveURL(/tab=cases/);
  await expect(page.getByRole("table", { name: "Client cases" })).toBeVisible();

  await sections.getByRole("button", { name: "Packages" }).click();
  await expect(page.getByRole("region", { name: "Packages they can use" })).toContainText("₹2,250");

  await sections.getByRole("button", { name: "Reports & MIS" }).click();
  await expect(page.getByRole("region", { name: "MIS" })).toBeVisible();
  await page.screenshot({ path: "test-results/rm-client-reports.png", fullPage: true });
});

test("RM sees a client's documents and opens its set-up from the client page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clientProfileFixture(page);
  const document = (type: string, label: string, file: object | null) => ({
    type,
    label,
    hint: "Required for activation.",
    required: true,
    signed: false,
    agreementId: file ? `agr-${type}` : null,
    signedAt: null,
    state: file ? "APPROVED" : "MISSING",
    file,
  });
  await page.route("**/api/v1/onboarding/companies/c-1", (route) =>
    route.fulfill({
      json: {
        id: "c-1",
        code: "NSL",
        legalName: "Northstar Labs Private Limited",
        displayName: "Northstar Labs",
        contactName: "Kavya Rao",
        contactEmail: "kavya@northstar.example",
        contactPhone: null,
        status: "ACTIVE",
        version: 3,
        signedUpAt: "2026-10-01T00:00:00Z",
        source: "ADDED_BY_SAPLING",
        submittedAt: null,
        rm: null,
        rmAssignedAt: null,
        progress: {
          detailsDone: false,
          documentsUploaded: 1,
          documentsApproved: 1,
          documentsRequired: 5,
          commercialDone: false,
          rmAssigned: false,
          clientDone: false,
          missing: [],
          done: 2,
          total: 13,
          percent: 15,
        },
        gstin: null,
        pan: null,
        billingAddress: null,
        billingTerms: null,
        note: null,
        packages: [],
        documents: [
          document("AGREEMENT", "Service agreement (MSA)", {
            id: "file-1",
            revision: 1,
            status: "APPROVED",
            name: "msa.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1000,
            uploadedAt: "2026-10-02T00:00:00Z",
            reviewNotes: null,
            reviewedAt: null,
            version: 1,
          }),
          document("PAN", "Company PAN card", null),
        ],
        flags: { personalEmail: false, possibleDuplicates: [] },
        rates: [],
        catalog: [],
        timeline: [],
        canManage: true,
        canSetUp: true,
        canSetPrice: false,
        canMessage: true,
      },
    }),
  );
  await page.goto("/spoc-rm/clients/c-1?tab=documents");
  const list = page.getByRole("list", { name: "Company documents" });
  await expect(list.getByText("msa.pdf")).toBeVisible();
  await expect(list.getByText("Not uploaded yet")).toBeVisible();
  await page.getByRole("link", { name: /Add or review documents/ }).click();
  await expect(page).toHaveURL(/\/spoc-rm\/onboarding\?company=c-1/);
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Edit details" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Back to client" })).toContainText(
    "Northstar Labs",
  );
});

test("RM resets a Client Admin's password from the client's Logins tab", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { resets } = await clientProfileFixture(page);
  await page.goto("/spoc-rm/clients/c-1?tab=logins");
  await page.getByRole("button", { name: "Reset password for Kavya Rao" }).click();
  const receipt = page.getByRole("dialog", { name: "New password issued" });
  await expect(receipt.getByText(/Also emailed to/)).toBeVisible();
  expect((resets[0] as { temporaryPassword: string }).temporaryPassword.length).toBeGreaterThan(10);
});

test("RM downloads the client dossier as a styled Excel file", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clientProfileFixture(page);
  await page.goto("/spoc-rm/clients/c-1");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Download client dossier/ }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("Sapling-Global-NSL-client-dossier.xlsx");
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(path!);
  // An .xlsx is a zip: it starts with "PK".
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  expect(bytes.length).toBeGreaterThan(4000);
});

test("from a client's profile the RM works elsewhere and comes back in one click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await clientProfileFixture(page);
  await page.goto("/spoc-rm/clients/c-1");
  await page
    .getByRole("region", { name: "Work for this client" })
    .getByRole("link", { name: /Cases in Records/ })
    .click();
  // Records keeps a real (UUID) client id; the sample id "c-1" is dropped by its search rules.
  await expect(page).toHaveURL(/\/spoc-rm\/records/);
  const back = page.getByRole("navigation", { name: "Back to client" });
  await expect(back).toContainText("Northstar Labs");
  await page.screenshot({ path: "test-results/rm-back-to-client.png" });
  await back.getByRole("link", { name: /Back to Northstar Labs/ }).click();
  await expect(page).toHaveURL(/\/spoc-rm\/clients\/c-1$/);
  await expect(page.getByRole("navigation", { name: "Back to client" })).toHaveCount(0);
});
