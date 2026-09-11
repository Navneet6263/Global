import { expect as baseExpect, test } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";
import { qaChecklist } from "../src/features/delivery/utils";

const expect = baseExpect.configure({ timeout: 20_000 });
for (const width of [1440, 390]) {
  test(`QA uses compact sections without irrelevant field evidence at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await qaBrowserFixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/qa-review");
    const nav = page.getByRole("navigation", { name: "Case review sections" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("button")).toHaveCount(3);
    await expect(page.getByText("Field evidence", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Live workspace summary" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Check results and findings" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Reviewer rationale" })).toHaveCount(0);
    await page.getByRole("button", { name: "Claim case", exact: true }).click();
    await expect(page.getByRole("button", { name: "Release", exact: true })).toBeEnabled();
    await page
      .getByRole("checkbox", { name: "Employment Mark only if rework is required" })
      .check();
    await nav.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByText("No case documents attached.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check results and findings" })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue to decision" }).click();
    const notes = page.getByRole("textbox", { name: "Reviewer rationale" });
    await notes.fill("Source and supporting evidence reviewed independently.");
    for (const label of qaChecklist)
      await page.getByRole("checkbox", { name: label, exact: true }).check();
    await page.getByRole("button", { name: "Return selected checks", exact: true }).click();
    await expect(page.getByText("1 checks selected for correction", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit controlled decision" })).toBeEnabled();
    await page.getByRole("button", { name: "Choose checks", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Employment Mark only if rework is required" }),
    ).toBeChecked();
    await nav.getByRole("button", { name: "Quality & decision" }).click();
    await expect(notes).toHaveValue("Source and supporting evidence reviewed independently.");
    await expect(
      page.getByRole("button", { name: "Return selected checks", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const body = page.getByRole("region", { name: "Review section content" });
    expect((await body.boundingBox())!.height).toBeLessThanOrEqual(541);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page
      .getByRole("region", { name: "Selected case review", exact: true })
      .screenshot({ path: `test-results/qa-sections-${width}.png` });
    expect(errors).toEqual([]);
    expect(fixture.unexpected).toEqual([]);
  });
}

test("QA shows field evidence only for a case with a linked visit and preserves document actions", async ({
  page,
}) => {
  const fixture = await qaBrowserFixture(page, {
    fieldVisits: [
      {
        publicId: "visit-1",
        status: "COMPLETED",
        address: "Test Branch, Noida",
        evidence: [
          {
            publicId: "evidence-1",
            type: "PHOTO",
            sha256: "abc123456789",
            capturedAt: new Date().toISOString(),
          },
        ],
      },
    ],
    documents: [
      {
        publicId: "document-1",
        type: "ADDRESS_PROOF",
        status: "ACCEPTED",
        currentVersion: 1,
        versions: [
          {
            originalName: "address-proof.pdf",
            contentType: "application/pdf",
            sha256: "abc123456789",
            malwareState: "CLEAN",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ],
  });
  await page.goto("/qa-review");
  const nav = page.getByRole("navigation", { name: "Case review sections" });
  await expect(nav.getByRole("button")).toHaveCount(4);
  await nav.getByRole("button", { name: "Field evidence" }).click();
  await expect(page.getByRole("heading", { name: "Field evidence", exact: true })).toBeVisible();
  await expect(page.getByText("Test Branch, Noida", { exact: true })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("Open controlled evidence")).toBeVisible();
  await page.getByRole("button", { name: "Claim case", exact: true }).click();
  await expect(page.getByRole("button", { name: "Release", exact: true })).toBeEnabled();
  await nav.getByRole("button", { name: "Documents" }).click();
  await expect(page.getByText("address-proof.pdf", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Preview/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Download/ })).toBeEnabled();
  expect(fixture.unexpected).toEqual([]);
});
