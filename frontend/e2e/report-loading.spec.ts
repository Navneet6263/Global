import { expect, test } from "@playwright/test";

test("downloading one client report spins only that row and unlocks after completion", async ({
  page,
}) => {
  const requests: string[] = [];
  const unexpected: string[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Contract-only API responses: no real client, document or database access.
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/me")
      return reply({
        id: "client-review-test",
        tenantId: "tenant-test",
        tenantName: "Test workspace",
        displayName: "Client Test",
        email: "client@example.invalid",
        roles: ["CLIENT_ADMIN"],
        permissions: ["case:read", "report:read", "notification:read"],
        mustChangePassword: false,
        clientId: "client-test",
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0, nextCursor: null });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: new Date().toISOString() });
    if (path === "/reports")
      return reply({
        items: [1, 2].map((id) => ({
          id: `report-${id}`,
          status: "PUBLISHED",
          currentVersion: 1,
          canDownload: true,
          publishedAt: "2026-09-09T10:00:00Z",
          latestVersion: null,
          case: {
            id: `case-${id}`,
            caseNumber: `TEST-00${id}`,
            subject: { fullName: `Candidate ${id}` },
          },
        })),
        nextCursor: null,
      });
    if (/^\/reports\/report-[12]\/content$/.test(path)) {
      requests.push(path);
      await gate;
      return route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: "Synthetic transport test file",
      });
    }
    unexpected.push(path);
    return reply({ detail: "Unexpected browser test request" }, 501);
  });
  await page.goto("/client-portal/reports");
  const first = page
    .locator("article")
    .filter({ hasText: "Candidate 1" })
    .getByRole("button", { name: "Download PDF" });
  const second = page
    .locator("article")
    .filter({ hasText: "Candidate 2" })
    .getByRole("button", { name: "Download PDF" });
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  await first.click();
  try {
    await expect(first).toHaveAttribute("aria-busy", "true");
    await expect(first).toBeDisabled();
    await expect(second).toBeDisabled();
    await expect(second).not.toHaveAttribute("aria-busy", "true");
    await expect.poll(() => requests).toEqual(["/reports/report-1/content"]);
  } finally {
    release();
  }
  await expect(first).toBeEnabled();
  await expect(second).toBeEnabled();
  await expect(first).not.toHaveAttribute("aria-busy", "true");
  await second.click();
  await expect
    .poll(() => requests)
    .toEqual(["/reports/report-1/content", "/reports/report-2/content"]);
  await expect(second).toBeEnabled();
  expect(unexpected).toEqual([]);
});
