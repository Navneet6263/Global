import { expect as baseExpect, test } from "@playwright/test";
import { operationsInboxFixture } from "./fixtures/operations-inbox-fixture";
const expect = baseExpect.configure({ timeout: 20_000 });

test("failed load shows an error instead of false zero counts and can retry", async ({ page }) => {
  const fixture = await operationsInboxFixture(page);
  fixture.fail(true);
  await page.goto("/operations");
  const inbox = page.getByRole("region", { name: "Operations action inbox" });
  await expect(inbox.getByRole("alert")).toBeVisible();
  await expect(inbox.getByRole("button", { name: /Documents to review/ })).toContainText("—");
  fixture.fail(false);
  await inbox.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(inbox.getByRole("listitem")).toHaveCount(8);
  await expect(inbox.getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const workload = await page
    .getByRole("heading", { name: "Live workload", exact: true })
    .boundingBox();
  const queue = await inbox.boundingBox();
  expect(workload && queue && workload.y < queue.y).toBeTruthy();
  const categories = await inbox
    .getByRole("navigation", { name: "Pending work categories" })
    .boundingBox();
  const list = await inbox.getByRole("list", { name: "Documents to review cases" }).boundingBox();
  expect(categories && list && categories.x + categories.width <= list.x + 1).toBeTruthy();
  await expect(inbox.getByRole("link").first()).toHaveText("Open");
  await inbox.screenshot({ path: "test-results/operations-inbox-desktop.png" });
});

test("cards filter server-paginated cases and search does not change global counts", async ({
  page,
}) => {
  const fixture = await operationsInboxFixture(page);
  await page.goto("/operations");
  const inbox = page.getByRole("region", { name: "Operations action inbox" });
  await expect(inbox.getByRole("button", { name: /Documents to review/ })).toContainText("9");
  await expect(inbox.getByRole("listitem")).toHaveCount(8);
  await inbox.getByRole("button", { name: "Next", exact: true }).click();
  await expect(inbox.getByText("Candidate 9", { exact: true })).toBeVisible();
  await expect(inbox.getByRole("listitem")).toHaveCount(1);
  await inbox.getByRole("button", { name: /Field assignment pending/ }).click();
  await expect(page).toHaveURL(/action=field_assignment/);
  await expect(
    inbox.getByText("Verifier work complete · physical visit still required"),
  ).toBeVisible();
  await inbox.getByRole("textbox", { name: "Search action inbox" }).fill("missing");
  await expect(inbox.getByText("No matching work in this queue")).toBeVisible();
  expect(fixture.requests.some((url) => url.searchParams.get("page") === "2")).toBeTruthy();
  await expect(inbox.getByRole("button", { name: /Documents to review/ })).toContainText("9");
});

test("field work opens the right case tab and returns to its filtered inbox", async ({ page }) => {
  await operationsInboxFixture(page);
  await page.goto("/operations?action=field_assignment");
  await page.getByRole("link", { name: "Assign field visit", exact: true }).click();
  await expect(page).toHaveURL(/tab=field-visits/);
  await expect(page.getByRole("tab", { name: "Field visits", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByPlaceholder("Complete visit address")).toBeVisible();
  await page.getByRole("link", { name: "Back to action inbox" }).click();
  await expect(page).toHaveURL(/action=field_assignment/);
  await expect(page.getByRole("button", { name: /Field assignment pending/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("refresh removes completed work and read-only users do not get dispatch controls", async ({
  page,
}) => {
  const fixture = await operationsInboxFixture(page, false);
  await page.goto("/operations?action=start");
  const inbox = page.getByRole("region", { name: "Operations action inbox" });
  await expect(inbox.getByRole("link", { name: "View readiness" })).toHaveCount(2);
  await expect(inbox.getByRole("button", { name: "Start & assign", exact: true })).toHaveCount(0);
  await inbox.getByRole("button", { name: /Documents to review/ }).click();
  await expect(inbox.getByRole("listitem")).toHaveCount(8);
  fixture.clearDocuments();
  await inbox.getByRole("button", { name: "Refresh inbox", exact: true }).click();
  await expect(inbox.getByText("No matching work in this queue")).toBeVisible();
});

test("mobile inbox fits the viewport and preserves colorful readable actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await operationsInboxFixture(page);
  await page.goto("/operations?action=field_review");
  await expect(
    page.getByRole("link", { name: "Review field evidence", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/operations-inbox-mobile.png", fullPage: true });
});
