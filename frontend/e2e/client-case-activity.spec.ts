import { expect, test } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";

for (const width of [390, 1440]) {
  test(`track case overview, activity filters and refresh at ${width}px`, async ({ page }) => {
    await clientPagesFixture(page);
    let reads = 0;
    await page.route("**/api/v1/cases/client-case-1", async (route) => {
      reads++;
      await route.fulfill({
        json: {
          id: "client-case-1",
          caseNumber: "SG-TEST-1",
          status: "IN_PROGRESS",
          priority: "NORMAL",
          version: 1,
          createdAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T10:00:00Z",
          dueAt: null,
          subject: { publicId: "subject-1", fullName: "Candidate 1" },
          client: { publicId: "test-client", code: "TEST", displayName: "Test Client" },
          checks: [
            {
              publicId: "check-1",
              type: "EDUCATION",
              status: "COMPLETED",
              result: "CLEAR",
              completedAt: "2026-10-01T10:00:00Z",
            },
          ],
          documents: [
            {
              publicId: "doc-1",
              type: "IDENTITY",
              status: "APPROVED",
              currentVersion: 1,
              version: 1,
              versions: [],
              reviewedAt: "2026-10-01T09:00:00Z",
            },
          ],
          consents: [],
          clarifications: [],
          reports: [],
          qaReviews: [],
          statusHistory: Array.from({ length: 10 }, (_, index) => ({
            fromStatus: "DOCUMENT_PENDING",
            toStatus: "IN_PROGRESS",
            reason: "INTERNAL SECRET",
            createdAt: `2026-10-01T0${index}:00:00Z`,
          })),
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/client-portal");
    await page.getByRole("button", { name: "Open case for Candidate 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Case detail" });
    await expect(dialog.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByText("The verification team is working")).toBeVisible();
    await expect(dialog.locator('[aria-current="step"]')).toContainText("Verification");
    await page.screenshot({
      path: `test-results/track-case-overview-${width}.png`,
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "View check progress" }).click();
    await expect(dialog.getByRole("tab", { name: /Checks/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog.locator("summary").click();
    await expect(dialog.getByText("Completed at", { exact: true })).toBeVisible();
    await dialog.getByRole("tab", { name: "Timeline", exact: true }).click();
    const log = dialog.getByRole("region", { name: "Case activity log" });
    await expect(log.locator("ol > li")).toHaveCount(8);
    await log.getByRole("button", { name: "Next activity page" }).click();
    await expect(log.locator("ol > li")).toHaveCount(5);
    await log.getByLabel("Filter activity type").selectOption("Documents");
    await expect(log.locator("ol > li")).toHaveCount(1);
    await expect(log).toContainText("Identity reviewed");
    await expect(log).not.toContainText("INTERNAL SECRET");
    await log.getByRole("searchbox").fill("nothing matches");
    await expect(log.getByText("No matching activity", { exact: true })).toBeVisible();
    await log.getByRole("searchbox").fill("");
    await log.getByLabel("Filter activity type").selectOption("All");
    await page.screenshot({
      path: `test-results/track-case-timeline-${width}.png`,
      animations: "disabled",
    });
    await dialog.getByRole("tab", { name: /Documents/ }).click();
    await expect(dialog.getByText("Version 1 uploaded · file details restricted")).toBeVisible();
    await expect(dialog.getByText("Upload is still pending")).toHaveCount(0);
    const before = reads;
    await dialog.getByRole("button", { name: "Refresh case", exact: true }).click();
    await expect.poll(() => reads).toBeGreaterThan(before);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}
