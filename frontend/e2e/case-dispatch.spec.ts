import { expect, test, type Page } from "@playwright/test";
import { dispatchFixture } from "./fixtures/dispatch-fixture";

async function openAllocation(page: Page) {
  await page.goto("/operations/cases");
  for (const id of [1, 2, 3])
    await page
      .getByRole("checkbox", { name: `Select DISPATCH-${id}`, exact: true })
      .filter({ visible: true })
      .check();
  await page.getByRole("button", { name: "Start & assign", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("PAN: reviewed, unexpired document required")).toBeVisible();
}

test("bulk start previews first, skips blocked cases and saves only after explicit allocation", async ({
  page,
}) => {
  const fixture = await dispatchFixture(page);
  await openAllocation(page);
  expect(fixture.commits).toHaveLength(0);
  const confirm = page.getByRole("button", { name: "Confirm start & assignment", exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("Verifier for DISPATCH-1", { exact: true }).selectOption("verifier-1");
  await page.getByLabel("Verifier for DISPATCH-2", { exact: true }).selectOption("verifier-2");
  await expect(page.getByText("5 projected", { exact: true })).toBeVisible();
  fixture.hold();
  await confirm.click();
  await expect.poll(() => fixture.commits.length).toBe(2);
  await expect(confirm).toBeDisabled();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  fixture.release();
  await expect(page.getByText("2 checks assigned successfully", { exact: true })).toHaveCount(2);
  expect(fixture.commits.map((item) => item.id).sort()).toEqual(["dispatch-1", "dispatch-2"]);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page
      .locator("#workspace-main")
      .getByRole("link", { name: "Assignment Workbench", exact: true }),
  ).toBeVisible();
  expect(fixture.unexpected).toEqual([]);
});

test("failed-only retry reuses the exact plan/key and never repeats successes", async ({
  page,
}) => {
  const fixture = await dispatchFixture(page);
  fixture.controls.failSecond = true;
  await openAllocation(page);
  await page.getByLabel("Allocation mode").selectOption("all");
  await page.getByLabel("Verifier for all ready cases").selectOption("verifier-1");
  await page.getByRole("button", { name: "Confirm start & assignment", exact: true }).click();
  await expect(page.getByText("Case changed; refresh readiness", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry failed only", exact: true }).click();
  await expect(page.getByText("2 checks assigned successfully", { exact: true })).toHaveCount(2);
  expect(fixture.commits.filter((item) => item.id === "dispatch-1")).toHaveLength(1);
  const retries = fixture.commits.filter((item) => item.id === "dispatch-2");
  expect(retries).toHaveLength(2);
  expect(retries[0]).toEqual(retries[1]);
  expect(fixture.unexpected).toEqual([]);
});

test("check-level split allocates each check explicitly and cancelling does not write", async ({
  page,
}) => {
  const fixture = await dispatchFixture(page);
  await openAllocation(page);
  await page.getByLabel("Allocation mode").selectOption("check");
  await page
    .getByLabel("Verifier for DISPATCH-1 IDENTITY", { exact: true })
    .selectOption("verifier-1");
  await page
    .getByLabel("Verifier for DISPATCH-1 EDUCATION", { exact: true })
    .selectOption("verifier-2");
  await expect(
    page.getByRole("button", { name: "Confirm start & assignment", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(fixture.commits).toHaveLength(0);
});

test("mobile dialog stays within viewport with scrollable content and visible actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 720 });
  const fixture = await dispatchFixture(page);
  await openAllocation(page);
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  await expect(
    page.getByRole("button", { name: "Confirm start & assignment", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/dispatch-mobile.png" });
  expect(fixture.unexpected).toEqual([]);
});
