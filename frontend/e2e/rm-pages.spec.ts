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
