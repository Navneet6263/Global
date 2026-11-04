import { expect, test } from "@playwright/test";
import { clientPagesFixture } from "./fixtures/client-pages-fixture";

test("the client sees what the candidate uploaded and that the case moved on", async ({ page }) => {
  await clientPagesFixture(page);
  await page.route("**/api/v1/cases/client-case-1", (route) =>
    route.fulfill({
      json: {
        id: "client-case-1",
        caseNumber: "SG-TEST-1",
        status: "DOCUMENT_PENDING",
        priority: "NORMAL",
        version: 1,
        createdAt: "2026-11-03T04:00:00Z",
        updatedAt: "2026-11-04T06:00:00Z",
        dueAt: null,
        tatWorkingDays: 14,
        clientProgress: {
          stage: "DOCUMENTS_RECEIVED",
          label: "Documents received",
          detail:
            "The candidate uploaded every document. Our team is checking them; verification starts next.",
          candidateSubmittedAt: "2026-11-04T06:00:00Z",
        },
        subject: { publicId: "subject-1", fullName: "Candidate 1" },
        client: { publicId: "test-client", code: "TEST", displayName: "Test Client" },
        checks: [{ publicId: "check-1", type: "EDUCATION", status: "PENDING" }],
        documentRequirements: [{ type: "EDUCATION_CERTIFICATE", checks: ["EDUCATION"] }],
        documents: [
          {
            publicId: "doc-1",
            type: "EDUCATION_CERTIFICATE",
            status: "UPLOADED",
            currentVersion: 1,
            version: 1,
            versions: [
              {
                version: 1,
                originalName: "degree-and-marksheet.pdf",
                contentType: "application/pdf",
                sizeBytes: 2_621_440,
                createdAt: "2026-11-04T05:50:00Z",
              },
            ],
          },
        ],
        consents: [],
        clarifications: [],
        reports: [],
        qaReviews: [],
        statusHistory: [],
      },
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/client-portal");
  await page.getByRole("button", { name: "Open case for Candidate 1", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Case detail" });
  const progress = dialog.getByRole("region", { name: "Case progress" });
  await expect(progress).toContainText("Documents received");
  await expect(progress).toContainText("Candidate uploaded all documents on");
  await expect(dialog.getByText("Documents received: our team is checking them")).toBeVisible();
  // No due date anywhere, only the turnaround.
  await expect(dialog.getByText("14 working days")).toBeVisible();
  await page.screenshot({ path: "test-results/client-candidate-uploaded.png" });
  await dialog.getByRole("button", { name: "View uploaded documents" }).click();
  await expect(dialog.getByText(/degree-and-marksheet\.pdf · 2\.5 MB · uploaded/)).toBeVisible();
  await dialog.getByRole("tab", { name: "Timeline", exact: true }).click();
  await expect(
    dialog
      .getByRole("region", { name: "Case activity log" })
      .getByText("Candidate uploaded all documents"),
  ).toBeVisible();
});
