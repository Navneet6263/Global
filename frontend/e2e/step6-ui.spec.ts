import { expect as baseExpect, test } from "@playwright/test";
import { operationsOverviewFixture } from "./fixtures/operations-overview-fixture";
import { operationsInboxFixture } from "./fixtures/operations-inbox-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("Operations assigns a company RM once and chooses which open cases move", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await operationsOverviewFixture(page);
  await page.goto("/operations/clients");
  await expect(page.getByRole("heading", { name: "Companies & RMs", level: 1 })).toBeVisible();
  const list = page.getByRole("list", { name: "Company RM assignments" });
  await expect(list.getByText("No company RM")).toBeVisible();
  await page.screenshot({ path: "test-results/step6-companies.png", fullPage: true });
  await list.getByRole("button", { name: "Assign RM" }).click();
  const dialog = page.getByRole("dialog", { name: "Assign company RM" });
  await expect(dialog.getByText("Already mapped")).toBeVisible();
  await expect(
    dialog.getByRole("radio", { name: /New cases \+ open cases without an RM/ }),
  ).toBeChecked();
  await dialog.getByText("Riya Mehta").click();
  await dialog.getByRole("radio", { name: /New cases \+ every open case/ }).check();
  await expect(dialog.getByText(/currently with another RM will move/)).toBeVisible();
  await page.screenshot({ path: "test-results/step6-company-dialog.png" });
  await dialog.getByRole("button", { name: "Assign RM", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const post = fixture.requests.find(
    (entry) => entry.method === "POST" && entry.path === "/workflow/clients/client-cedar/rm",
  );
  expect(post?.body).toEqual({ rmUserId: "rm-riya", version: 2, apply: "ALL_OPEN" });
});

test("Operations stops a case on client instruction with a reason", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await operationsOverviewFixture(page);
  await page.goto("/cases/ops-case-3");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Stop verification" });
  const confirm = dialog.getByRole("button", { name: "Stop case" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Client instruction / reason").fill("Client withdrew the offer");
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  const stop = fixture.requests.find(
    (entry) => entry.method === "POST" && entry.path === "/workflow/cases/ops-case-3/stop",
  );
  expect(stop?.body).toEqual({ version: 3, reason: "Client withdrew the offer" });
});

test("overview shows check outcomes for checks and cases", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsOverviewFixture(page);
  await page.goto("/operations");
  const colours = page.getByRole("region", { name: "Check results" });
  await expect(colours.getByText("Minor discrepancy")).toBeVisible();
  await expect(colours.getByText("Verified verbally")).toBeVisible();
  await expect(colours.getByLabel("Cases by outcome")).toBeVisible();
  await colours.scrollIntoViewIfNeeded();
  await colours.screenshot({ path: "test-results/step6-colours.png" });
});

test("Needs attention opens with today's focus, flow and a clean inbox", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsInboxFixture(page);
  await page.goto("/operations/attention");
  const focus = page.getByRole("region", { name: "Today's focus" });
  await expect(focus.getByRole("link", { name: /Overdue cases\s*3/ })).toBeVisible();
  await expect(focus.getByRole("link", { name: /Companies without an RM\s*1/ })).toHaveAttribute(
    "href",
    /\/operations\/clients/,
  );
  const inbox = page.getByRole("region", { name: "Operations action inbox" });
  await expect(inbox.getByRole("listitem")).toHaveCount(8);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/step6-attention.png", fullPage: true });
});

test("Operations chooses which work-queue columns to see, and the choice is remembered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await operationsOverviewFixture(page);
  await page.goto("/operations");
  const queue = page.getByRole("region", { name: "Work queue" });
  const headers = queue.locator("thead th");
  await expect(headers.filter({ hasText: "Working with" })).toHaveCount(1);
  await queue.getByRole("button", { name: /Columns/ }).click();
  await page.getByRole("menuitemcheckbox", { name: "Working with" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Package" }).click();
  await page.keyboard.press("Escape");
  await expect(headers.filter({ hasText: "Working with" })).toHaveCount(0);
  await expect(headers.filter({ hasText: "Package" })).toHaveCount(1);
  await page.reload();
  await expect(headers.filter({ hasText: "Package" })).toHaveCount(1);
  await expect(headers.filter({ hasText: "Working with" })).toHaveCount(0);
  await queue.screenshot({ path: "test-results/ops-queue-columns.png" });
});

test("Operations sets a company's intake rules: client reviews first and auto Data Entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const fixture = await operationsOverviewFixture(page);
  await page.goto("/operations/clients");
  await page.getByRole("button", { name: "Intake rules for Horizon Tech" }).click();
  const dialog = page.getByRole("dialog", { name: "Intake rules · Horizon Tech" });
  const save = dialog.getByRole("button", { name: "Save rules" });
  await expect(save).toBeDisabled();
  await dialog.getByRole("switch", { name: "Client reviews the submission first" }).click();
  await dialog.getByLabel("Auto-assign Data Entry to").selectOption("de-sara");
  await page.screenshot({ path: "test-results/intake-rules.png" });
  await save.click();
  await expect(dialog).toHaveCount(0);
  const patch = fixture.requests.find(
    (entry) =>
      entry.method === "PATCH" && entry.path === "/workflow/clients/client-horizon/intake-rules",
  );
  expect(patch?.body).toEqual({
    version: 4,
    clientReviewFirst: true,
    defaultDataEntryUserId: "de-sara",
  });
});
