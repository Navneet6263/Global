import { expect, test } from "@playwright/test";
import { methodBrowserFixture } from "./fixtures/method-browser-fixture";

test("case sources show reviewed evidence and submit the exact file version", async ({ page }) => {
  const fixture = await methodBrowserFixture(page);
  await page.goto("/cases/method-case");
  await expect(page.getByRole("heading", { name: "Source UI Test" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Service scope", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Checks (1)", exact: true }).click();
  await page.getByRole("button", { name: "Sources & methods", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Digital source/ }).click();
  await expect(dialog.getByText(/Live provider verification.*Coming soon/)).toBeVisible();
  expect(fixture.writes).toEqual([]);
  await dialog.getByRole("button", { name: /Third-party source/ }).click();
  const track = dialog.getByRole("button", { name: "Track source request", exact: true });
  await expect(track).toBeDisabled();
  await dialog.getByLabel("Provider / source").fill("Authorised institute");
  await dialog.getByLabel("Authorised source contact").fill("registrar@example.invalid");
  await track.click();
  await expect.poll(() => fixture.writes.length).toBe(1);
  await dialog.getByRole("button", { name: "Record response", exact: true }).click();
  await dialog.getByLabel("Source reference", { exact: true }).fill("SOURCE-TEST-002");
  await dialog
    .getByLabel("Factual response summary")
    .fill("Authorised source confirmed the submitted details against the reviewed document.");
  const record = dialog.locator('button[type="submit"]').filter({ hasText: "Record response" });
  await expect(record).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "PAN · v2", exact: true }).check();
  await record.click();
  await expect.poll(() => fixture.writes.length).toBe(2);
  expect(fixture.writes[1]?.evidenceVersions).toEqual([{ documentId: "document-1", version: 2 }]);
  await expect(dialog.getByRole("button", { name: "Record response", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(fixture.unexpected).toEqual([]);
});

test("source contact history is paginated and records the displayed request version", async ({
  page,
}) => {
  const fixture = await methodBrowserFixture(page);
  fixture.methods.push({
    id: "source-1",
    method: "THIRD_PARTY",
    provider: "Synthetic source",
    sourceContact: "source@example.invalid",
    status: "REQUESTED",
    result: null,
    version: 1,
    evidenceIds: [],
    requestedAt: "2026-09-08T10:00:00Z",
    respondedAt: null,
  });
  for (let i = 0; i < 9; i++)
    fixture.contacts.push({
      id: `contact-${i}`,
      channel: "PHONE",
      outcome: "NO_RESPONSE",
      notes: `Synthetic contact attempt ${i}`,
      actorName: "Test Operations",
      occurredAt: "2026-09-08T10:30:00Z",
      createdAt: "2026-09-08T10:30:00Z",
      nextFollowUpAt: null,
    });
  await page.goto("/cases/method-case");
  await page.getByRole("tab", { name: "Checks (1)", exact: true }).click();
  await page.getByRole("button", { name: "Sources & methods", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Contact tracker", exact: true }).click();
  const history = dialog.getByRole("region", { name: "Source outreach history" });
  await expect(history.getByText("Synthetic contact attempt 0", { exact: true })).toBeVisible();
  await expect(history.getByText("Synthetic contact attempt 8", { exact: true })).toHaveCount(0);
  await history.getByRole("button", { name: "Next", exact: true }).click();
  await expect(history.getByText("Synthetic contact attempt 8", { exact: true })).toBeVisible();
  await history.getByLabel("Contact channel").selectOption("EMAIL");
  await history.getByLabel("Contact outcome").selectOption("CONTACTED");
  await history
    .getByLabel("What happened?")
    .fill("Source confirmed receipt through the authorised channel.");
  await history.getByRole("button", { name: "Record contact", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBe(1);
  expect(fixture.writes[0]).toMatchObject({ version: 1, channel: "EMAIL", outcome: "CONTACTED" });
  await expect(
    history.getByText("Source confirmed receipt through the authorised channel.", { exact: true }),
  ).toBeVisible();
  await expect(history.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  expect(fixture.unexpected).toEqual([]);
});
