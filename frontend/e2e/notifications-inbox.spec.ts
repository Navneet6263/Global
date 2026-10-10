import { expect, test, type Page } from "@playwright/test";
import { qaBrowserFixture } from "./fixtures/qa-browser-fixture";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  category: "urgent" | "review" | "work" | "finance" | "other";
};

/** A 45-item inbox served page by page, as the API does (synthetic data only). */
async function inbox(page: Page) {
  const kinds = [
    ["QA_READY", "review", "Case ready for QA"],
    ["TASK_ASSIGNED", "work", "New check assigned"],
    ["VENDOR_CHECK_OVERDUE", "urgent", "Vendor check overdue"],
    ["INVOICE", "finance", "Invoice issued"],
  ] as const;
  const items: Item[] = Array.from({ length: 45 }, (_, index) => {
    const [type, category, title] = kinds[index % kinds.length]!;
    return {
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      type,
      category,
      title: `${title} #${index + 1}`,
      body: `Synthetic notification number ${index + 1} for the inbox test.`,
      href: null,
      readAt: index % 3 === 0 ? null : new Date(Date.now() - 3600000).toISOString(),
      createdAt: new Date(Date.now() - index * 5 * 3600000).toISOString(),
    };
  });
  const calls: string[] = [];
  await page.route("**/api/v1/notifications**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    calls.push(`${request.method()} ${path}${url.search}`);
    const reply = (json: unknown) => route.fulfill({ status: 200, json });
    if (path === "/notifications/read-all") {
      const count = items.filter((item) => !item.readAt).length;
      for (const item of items) item.readAt ??= new Date().toISOString();
      return reply({ read: count });
    }
    const toggle = path.match(/^\/notifications\/([^/]+)\/(read|unread)$/);
    if (toggle) {
      const item = items.find((entry) => entry.id === toggle[1])!;
      item.readAt = toggle[2] === "read" ? new Date().toISOString() : null;
      return reply({ read: toggle[2] === "read" });
    }
    const unread = url.searchParams.get("unread") === "true";
    const category = url.searchParams.get("category");
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const cursor = url.searchParams.get("cursor");
    const filtered = items.filter(
      (item) =>
        (!unread || !item.readAt) &&
        (!category || item.category === category) &&
        (!search || `${item.title} ${item.body}`.toLowerCase().includes(search)),
    );
    const start = cursor ? filtered.findIndex((item) => item.id === cursor) + 1 : 0;
    const pageItems = filtered.slice(start, start + limit);
    const counts = Object.fromEntries(
      ["urgent", "review", "work", "finance", "other"].map((name) => [
        name,
        {
          total: items.filter((item) => item.category === name).length,
          unread: items.filter((item) => item.category === name && !item.readAt).length,
        },
      ]),
    );
    return reply({
      unread: items.filter((item) => !item.readAt).length,
      total: items.length,
      counts,
      nextCursor: start + limit < filtered.length ? pageItems.at(-1)!.id : null,
      items: pageItems,
    });
  });
  return { calls, items };
}

test("notification inbox: filters, search, read / unread and loading more on scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await qaBrowserFixture(page);
  const { calls } = await inbox(page);
  await page.goto("/qa-review/overview");
  const bell = page.getByRole("button", { name: /^Notifications, 15 unread$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  const feed = panel.getByRole("feed", { name: "Notification list" });
  await expect(feed.getByRole("listitem")).toHaveCount(20);
  await expect(panel.getByText("Today", { exact: true })).toBeVisible();
  await page.waitForTimeout(600); // slide-in animation
  await page.screenshot({ path: "test-results/notifications-inbox.png" });

  // Scrolling to the bottom loads the next pages until everything is shown.
  for (const expected of [40, 45]) {
    await feed.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(feed.getByRole("listitem")).toHaveCount(expected);
  }
  await expect(panel.getByText("That's everything · 45 shown")).toBeVisible();
  expect(calls.filter((call) => call.includes("cursor=")).length).toBe(2);

  // Unread only, then one category.
  await panel.getByRole("radio", { name: /Unread/ }).click();
  await expect(feed.getByRole("listitem")).toHaveCount(15);
  await panel.getByRole("button", { name: /^Urgent/ }).click();
  await expect(feed.getByRole("listitem")).toHaveCount(4);
  expect(calls.at(-1)).toContain("unread=true");
  expect(calls.at(-1)).toContain("category=urgent");

  // Mark one as read; it leaves the Unread list.
  const first = feed.getByRole("listitem").first();
  await first.hover();
  await first.getByRole("button", { name: /as read$/ }).click();
  await expect(feed.getByRole("listitem")).toHaveCount(3);

  // Search across all notifications.
  await panel.getByRole("radio", { name: /^All/ }).click();
  await panel.getByRole("button", { name: "All types" }).click();
  await panel.getByLabel("Search notifications").fill("#42");
  await expect(feed.getByRole("listitem")).toHaveCount(1);
  await expect(feed.getByText("New check assigned #42")).toBeVisible();
  const row = feed.getByRole("listitem").first();
  await row.hover();
  await row.getByRole("button", { name: /as unread$/ }).click();
  await expect(row.getByRole("button", { name: /as read$/ })).toBeAttached();

  await panel.getByLabel("Search notifications").fill("");
  await panel.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText(/marked as read/)).toBeVisible();
  // The bell (behind the open panel) shows no unread count any more.
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Notifications", exact: true })).toBeVisible();
});

test("notification inbox fits a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await qaBrowserFixture(page);
  await inbox(page);
  await page.goto("/qa-review/overview");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(panel.getByRole("feed").getByRole("listitem")).toHaveCount(20);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
    true,
  );
  await page.waitForTimeout(600); // slide-in animation
  await page.screenshot({ path: "test-results/notifications-inbox-phone.png" });
});
