import { expect, test } from "@playwright/test";
import { setupL2InsufficiencyFixture } from "./fixtures/l2-insufficiency-fixture";
import { tinyPdf } from "./fixtures/workflow-fixture";

const PDF_V2 = tinyPdf("Relieving letter v2 clear scan");
const PDF_V3 = tinyPdf("Relieving letter v3 full uncropped");

test("full L2 workflow: Verifier -> Candidate -> Ops -> Data Entry reject/re-upload -> accept -> Verifier completion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sim = await setupL2InsufficiencyFixture(page);

  // 1. Verifier raises L2 insufficiency & sees active-L2 duplicate guard
  await page.goto("/verifier/queue?taskId=task-l2-1");
  await page
    .getByRole("tab", { name: "Insufficiency" })
    .or(page.getByRole("button", { name: "Insufficiency" }))
    .click();
  await page.getByLabel("Insufficiency subject").fill("Unclear relieving letter");
  await page.getByLabel("Requested document type").selectOption("EMPLOYMENT_PROOF");
  await page
    .getByLabel("Insufficiency instructions")
    .fill("Upload a clear stamped relieving letter.");
  await page.getByRole("button", { name: "Raise insufficiency" }).click();

  await expect(
    page.getByText("An L2 clarification is already active for this check"),
  ).toBeVisible();
  await expect(page.getByText("On hold for an insufficiency.")).toBeVisible();

  // 2. Candidate uploads v2 via multipart submission + explanation
  await page.goto("/candidate/acc-l2-1#token=tok-l2-1");
  await expect(page.getByText("Unclear relieving letter")).toBeVisible();
  await expect(page.getByRole("button", { name: /Complete — I've uploaded/ })).toBeDisabled();
  await page.getByLabel(/Select corrected/i).setInputFiles({
    name: "relieving-v2.pdf",
    mimeType: "application/pdf",
    buffer: PDF_V2,
  });
  await page.getByLabel("Clarification explanation").fill("Uploaded stamped relieving letter v2.");
  await page.getByRole("button", { name: "Submit document & explanation" }).click();
  await expect(page.getByText(/Uploaded relieving-v2\.pdf \(v2\)/)).toBeVisible();
  await expect(page.getByText(/Operations team is reviewing your document/)).toBeVisible();

  // 3. Operations inspects v2 preview & version history, then hands off to Data Entry
  sim.switchRole("OPS_MANAGER");
  await page.goto("/operations/clarifications");
  await expect(page.getByText("Unclear relieving letter")).toBeVisible();
  await expect(page.getByText(/Submitted: Employment Proof · v2/)).toBeVisible();
  await page.getByText("Version history (2)").click();
  await expect(page.getByText(/v1 · relieving-letter-v1\.pdf · Verified/)).toBeVisible();

  const previewPopupV2 = page.waitForEvent("popup").catch(() => null);
  await page
    .getByRole("button", { name: /Preview Employment Proof v2/ })
    .first()
    .click();
  const pop2 = await previewPopupV2;
  if (pop2) await pop2.close().catch(() => undefined);
  await expect
    .poll(() =>
      sim.requests.some(
        (r) => r.path === "/documents/doc-l2-1/preview" && r.search === "?version=2",
      ),
    )
    .toBe(true);

  await page.getByLabel("Assign Data Entry for SG-2026-L201").selectOption("de-sara");
  await page.getByPlaceholder("Note for Data Entry (optional)").fill("Verify dates against v2");
  await page.getByRole("button", { name: "Done · Send to Data Entry" }).click();
  await expect(page.getByText(/Handed off to Sara Khan/)).toBeVisible();

  // 4. Data Entry rejects v2 with mandatory 5-1000 char reason (preserving v1 baseline)
  sim.switchRole("DATA_ENTRY");
  await page.goto("/data-entry");
  await expect(page.getByText("L2 Re-entry").first()).toBeVisible();
  await page.getByRole("button", { name: /Review Asha Verma/ }).click();
  await expect(page.getByText("Shared document impacts 1 other check(s)")).toBeVisible();
  await expect(page.getByText(/Address \(Completed\)/)).toBeVisible();

  await page.getByRole("button", { name: "Reject document" }).click();
  await page.getByLabel("Rejection reason").fill("bad");
  await expect(page.getByText(/at least 5 characters/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm Reject & Request Re-upload" }),
  ).toBeDisabled();

  await page.getByLabel("Rejection reason").fill("Bottom stamp on page 2 is cropped off.");
  await page.getByRole("button", { name: "Confirm Reject & Request Re-upload" }).click();
  await expect(page.getByText("All caught up")).toBeVisible();
  expect(sim.getState().versions).toEqual([
    { version: 1, reviewStatus: "VERIFIED" },
    { version: 2, reviewStatus: "REJECTED" },
  ]);

  // 5. Candidate sees rejection reason & re-uploads v3
  await page.goto("/candidate/acc-l2-1#token=tok-l2-1");
  await expect(page.getByText(/Previous upload rejected \(attempt #2\)/)).toBeVisible();
  await expect(
    page.getByRole("alert").getByText("Bottom stamp on page 2 is cropped off."),
  ).toBeVisible();
  await page.getByLabel(/Select corrected/i).setInputFiles({
    name: "relieving-v3-full.pdf",
    mimeType: "application/pdf",
    buffer: PDF_V3,
  });
  await page
    .getByLabel("Clarification explanation")
    .fill("Re-uploaded full uncropped relieving letter v3.");
  await page.getByRole("button", { name: "Re-upload corrected document" }).click();
  await expect(page.getByText(/Uploaded relieving-v3-full\.pdf \(v3\)/)).toBeVisible();

  // 6. Ops hands off v3 -> Data Entry previews v3, edits check details & accepts v3
  sim.switchRole("OPS_MANAGER");
  await page.goto("/operations/clarifications");
  await expect(page.getByText("Re-upload #2")).toBeVisible();
  await page.getByRole("button", { name: "Done · Send to Data Entry" }).click();
  await expect(page.getByText(/Handed off to Sara Khan/)).toBeVisible();

  sim.switchRole("DATA_ENTRY");
  await page.goto("/data-entry");
  await expect(page.getByText("L2 Re-entry").first()).toBeVisible();
  await page.getByRole("button", { name: /Review Asha Verma/ }).click();
  await expect(page.getByText("Candidate upload to inspect: Employment Proof · v3")).toBeVisible();

  const previewPopupV3 = page.waitForEvent("popup").catch(() => null);
  await page
    .getByRole("button", { name: /Preview Employment Proof v3/ })
    .first()
    .click();
  const pop3 = await previewPopupV3;
  if (pop3) await pop3.close().catch(() => undefined);
  await expect
    .poll(() =>
      sim.requests.some(
        (r) => r.path === "/documents/doc-l2-1/preview" && r.search === "?version=3",
      ),
    )
    .toBe(true);

  await page.getByLabel("Employment 1 Employer name").fill("Acme Global Pvt Ltd");
  await page.getByLabel("Employment 1 Employee code").fill("EMP-9021");
  await page
    .getByPlaceholder("Summary of corrected details entered…")
    .fill("Updated employer name and code from v3.");
  await page.getByRole("button", { name: "Accept v3 & return check to Verifier" }).click();
  await expect(page.getByText("All caught up")).toBeVisible();

  expect(sim.getState()).toMatchObject({
    caseStatus: "IN_PROGRESS",
    depCheckStatus: "IN_PROGRESS",
    currentVersion: 3,
    taskStatus: "OPEN",
    versions: [
      { version: 1, reviewStatus: "SUPERSEDED" },
      { version: 2, reviewStatus: "REJECTED" },
      { version: 3, reviewStatus: "VERIFIED" },
    ],
    lhsEntries: [{ employerName: "Acme Global Pvt Ltd", empCode: "EMP-9021" }],
  });

  // 7. Verifier sees "All details re-entered by Data Entry" & completes independent verification
  sim.switchRole("VERIFIER");
  await page.goto("/verifier/queue?taskId=task-l2-1");
  await expect(page.getByText("All details re-entered by Data Entry.")).toBeVisible();

  await page.getByRole("button", { name: "Insufficiency" }).click();
  await expect(
    page.getByText("All details re-entered by Data Entry", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Acme Global Pvt Ltd").first()).toBeVisible();
  await page.getByText("Version history (3)").click();
  await expect(page.getByText(/v3 · relieving-v3-full\.pdf · Verified/)).toBeVisible();

  await page.getByRole("button", { name: "Verification", exact: true }).click();
  await page.getByRole("button", { name: "Start verification" }).click();
  await page.getByRole("button", { name: /Verified details/ }).click();
  await page.getByLabel("Verified 1 Employer name (confirmed)").fill("Acme Global Pvt Ltd");
  await page.getByLabel("Verified 1 Verified by (name)").fill("Meera HR");
  await page.getByLabel("Verified 1 Method of verification").selectOption("Email");
  await page.getByLabel("Verified 1 Verification date").fill("2026-11-11");
  await page.getByRole("button", { name: "Save verified details" }).click();
  await expect
    .poll(() =>
      sim.requests.some(
        (r) => r.method === "PUT" && r.path === "/checks/chk-emp-l2/verified-details",
      ),
    )
    .toBe(true);

  await page.getByRole("button", { name: /Outcome & summary/ }).click();
  await page.getByLabel("What did you find").selectOption({ label: "All details verified" });
  await page
    .getByPlaceholder("Source, verification method, dates and response received")
    .fill("HR confirmed Acme Global Pvt Ltd employment on 11 Nov.");
  await page.getByRole("button", { name: "Complete check" }).click();

  await expect.poll(() => sim.getState().taskStatus).toBe("COMPLETED");
});
