import { expect as baseExpect, test, type Page } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 20_000 });

const CLIENT = "11111111-1111-4111-8111-111111111111";
const PKG = "22222222-2222-4222-8222-222222222222";

type Who = "OPS" | "RM";

/** Browser-only fixture: packages, RM discount limit and client discounts in memory. */
async function pricingFixture(page: Page, who: Who) {
  const writes: Array<{ method: string; path: string; body: unknown }> = [];
  const pkg = {
    id: PKG,
    code: "STANDARD_BGV",
    name: "Standard BGV",
    serviceFamily: "HIRECHECK",
    checks: ["IDENTITY", "EMPLOYMENT"],
    requiredDocuments: [],
    price: 2000,
    tatHours: 72,
    maxRmDiscountPercent: 10,
    checkPrices: {} as Record<string, number>,
    taxRate: 18,
    isActive: true,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
  const packages = [pkg];
  let discount = 0;
  const session =
    who === "OPS"
      ? {
          id: "user-ops",
          tenantId: "tenant-1",
          tenantName: "Sapling Global",
          displayName: "Operations Manager",
          email: "ops@example.invalid",
          roles: ["OPS_MANAGER"],
          permissions: ["dashboard:read", "client:read", "case:read", "user:read"],
          mustChangePassword: false,
        }
      : {
          id: "user-rm",
          tenantId: "tenant-1",
          tenantName: "Sapling Global",
          displayName: "Ravi RM",
          email: "rm@example.invalid",
          roles: ["SPOC_RM"],
          permissions: ["dashboard:read", "case:read", "notification:read"],
          mustChangePassword: false,
        };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    const body = request.postData() ? (JSON.parse(request.postData()!) as unknown) : undefined;
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (method !== "GET") writes.push({ method, path, body });
    if (path === "/auth/me") return reply(session);
    if (path === "/auth/refresh") return reply({ message: "Unauthorized" }, 401);
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {}, generatedAt: pkg.createdAt });
    if (path === "/packages" && method === "GET") return reply({ items: packages });
    if (path === "/packages" && method === "POST") {
      const input = body as { code: string; name: string; maxRmDiscountPercent: number };
      const created = {
        ...pkg,
        id: "33333333-3333-4333-8333-333333333333",
        code: input.code,
        name: input.name,
        maxRmDiscountPercent: input.maxRmDiscountPercent,
      };
      packages.push(created);
      return reply(created, 201);
    }
    if (path === `/packages/${PKG}` && method === "PATCH") {
      Object.assign(pkg, body as object, { updatedAt: "2026-10-02T00:00:00Z" });
      return reply(pkg);
    }
    if (path === "/client-pricing" && method === "GET")
      return reply({ items: [{ id: CLIENT, name: "Acme Technologies", status: "ACTIVE" }] });
    if (path === `/client-pricing/${CLIENT}` && method === "GET")
      return reply({
        client: { id: CLIENT, name: "Acme Technologies" },
        canSetAnyDiscount: who === "OPS",
        items: [
          {
            packageId: PKG,
            code: pkg.code,
            name: pkg.name,
            listPrice: 2000,
            maxRmDiscountPercent: 10,
            yourLimitPercent: who === "OPS" ? 100 : 10,
            discountPercent: discount,
            finalPrice: 2000 * (1 - discount / 100),
            note: null,
            setBy: discount ? session.displayName : null,
            updatedAt: discount ? pkg.updatedAt : null,
          },
        ],
      });
    if (path === `/client-pricing/${CLIENT}/${PKG}` && method === "PUT") {
      discount = (body as { discountPercent: number }).discountPercent;
      return reply({ packageId: PKG, discountPercent: discount });
    }
    return reply({ items: [], total: 0 });
  });
  return { writes };
}

test("Operations builds a package with an RM discount limit and gives a client any discount", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { writes } = await pricingFixture(page, "OPS");
  await page.goto("/operations/packages");
  await expect(page.getByRole("heading", { name: "Packages & pricing" })).toBeVisible();
  const table = page.getByRole("table", { name: "Packages" });
  await expect(table.getByText("Standard BGV")).toBeVisible();
  await expect(table.getByRole("cell", { name: "10%" })).toBeVisible();

  await page.getByRole("button", { name: "New package" }).click();
  const dialog = page.getByRole("dialog", { name: "Add service package" });
  await dialog.getByPlaceholder("STANDARD_BGV").fill("PREMIUM_BGV");
  await dialog.getByPlaceholder("Standard BGV").fill("Premium BGV");
  await dialog.getByLabel("Max RM discount (%)").fill("15");
  await dialog.getByText("IDENTITY", { exact: true }).click();
  await dialog.getByRole("button", { name: "Add package" }).click();
  await expect(table.getByText("Premium BGV")).toBeVisible();
  expect(writes[0]).toMatchObject({
    method: "POST",
    path: "/packages",
    body: { code: "PREMIUM_BGV", maxRmDiscountPercent: 15 },
  });

  // Operations is not capped by the RM limit.
  const discount = page.getByLabel("Standard BGV discount percent");
  await discount.fill("25");
  await expect(page.getByText(/You can give up to/)).toHaveCount(0);
  await expect(page.getByText("₹1,500")).toBeVisible();
  await page.screenshot({ path: "test-results/packages-ops.png", fullPage: true });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => writes.at(-1)?.body).toEqual({ discountPercent: 25 });
});

test("an RM can discount its client only up to the package limit", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  const { writes } = await pricingFixture(page, "RM");
  await page.goto("/spoc-rm/pricing");
  await expect(page.getByRole("heading", { name: "Client pricing" })).toBeVisible();
  await expect(page.getByText("RM limit 10%")).toBeVisible();
  const discount = page.getByLabel("Standard BGV discount percent");
  const save = page.getByRole("button", { name: "Save", exact: true });

  await discount.fill("12");
  await expect(page.getByRole("alert")).toContainText("up to 10%");
  await expect(save).toBeDisabled();

  await discount.fill("10");
  await page.getByLabel("Standard BGV discount reason").fill("Annual volume");
  await expect(page.getByText("₹1,800")).toBeVisible();
  await page.screenshot({ path: "test-results/packages-rm.png", fullPage: true });
  await save.click();
  await expect
    .poll(() => writes.at(-1))
    .toMatchObject({
      method: "PUT",
      path: `/client-pricing/${CLIENT}/${PKG}`,
      body: { discountPercent: 10, note: "Annual volume" },
    });
  await expect(page.getByText("Last set by Ravi RM")).toBeVisible();
});

test("the client pricing page fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await pricingFixture(page, "RM");
  await page.goto("/spoc-rm/pricing");
  await expect(page.getByLabel("Standard BGV discount percent")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});

test("Operations sets a price per check and GST on a package", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { writes } = await pricingFixture(page, "OPS");
  await page.goto("/operations/packages");
  await expect(page.getByRole("table", { name: "Packages" })).toContainText("+ 18% GST");
  await page.getByRole("button", { name: "Edit Standard BGV" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit STANDARD_BGV" });
  await expect(dialog.getByText("Price per check & GST")).toBeVisible();
  // Two checks in a 2,000 package: an empty box means an equal share of 1,000.
  await expect(dialog.getByLabel("EMPLOYMENT price")).toHaveAttribute("placeholder", "1000");
  await dialog.getByLabel("EMPLOYMENT price").fill("1500");
  await dialog.getByLabel("GST percent").fill("12");
  await expect(dialog.getByText(/All checks bought one by one: ₹2,500/)).toBeVisible();
  await page.screenshot({ path: "test-results/packages-check-prices.png" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => writes.find((entry) => entry.method === "PATCH")?.body)
    .toMatchObject({ checkPrices: { EMPLOYMENT: 1500 }, taxRate: 12 });
  await expect(page.getByRole("table", { name: "Packages" })).toContainText("+ 12% GST");
});
