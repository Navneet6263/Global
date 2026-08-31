import { expect, test } from "@playwright/test";

test("service worker serves a data-free protected shell after an offline relaunch", async ({
  context,
  page,
}) => {
  await page.goto("/offline.html");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        });
      });
    }
  });

  await context.setOffline(true);
  try {
    await page.goto("/field-executive", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Sapling Global | Offline");
    await expect(
      page.getByRole("heading", { name: "Your protected drafts are still here." }),
    ).toBeVisible();
    await expect(
      page.getByText("This offline shell contains no case", { exact: false }),
    ).toBeVisible();
    await expect(page.locator("#field-count")).toHaveText("0");
    await expect(page.locator("#verifier-count")).toHaveText("0");
    await expect(page.getByRole("button", { name: "Reconnect to workspace" })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
});
