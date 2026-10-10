import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  // No session marker: a first visit, or after signing out.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the sign-in page makes no session check, so the console stays clean", async ({ page }) => {
    const calls: string[] = [];
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/api/v1/**", (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
      calls.push(path);
      return route.fulfill({ status: 401, json: { title: "Not signed in" } });
    });
    await page.goto("/auth");
    await expect(page.getByRole("button", { name: /sign in|log in/i }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(calls.filter((path) => path === "/auth/me" || path === "/auth/refresh")).toEqual([]);
    expect(errors.filter((text) => text.includes("401"))).toEqual([]);
  });

  test("opening a workspace page while signed out goes to sign-in without 401s", async ({
    page,
  }) => {
    const calls: string[] = [];
    await page.route("**/api/v1/**", (route) => {
      calls.push(new URL(route.request().url()).pathname.replace("/api/v1", ""));
      return route.fulfill({ status: 401, json: { title: "Not signed in" } });
    });
    await page.goto("/qa-review");
    await expect(page).toHaveURL(/\/auth/);
    expect(calls.filter((path) => path === "/auth/me" || path === "/auth/refresh")).toEqual([]);
  });
});

test("with the session marker the app still checks the session", async ({ page }) => {
  const calls: string[] = [];
  await page.route("**/api/v1/**", (route) => {
    calls.push(new URL(route.request().url()).pathname.replace("/api/v1", ""));
    return route.fulfill({ status: 401, json: { title: "Session expired" } });
  });
  await page.goto("/qa-review");
  await expect(page).toHaveURL(/\/auth/);
  expect(calls).toContain("/auth/me");
  // The expired session clears the marker, so the next visit is quiet.
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "sg_session")).toBe(false);
});
