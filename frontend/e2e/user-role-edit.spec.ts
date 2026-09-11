import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const requests: Record<string, unknown>[] = [];
  const controls = { fail: false, hold: false };
  let release = () => {};
  let gate = Promise.resolve();
  const user = {
    id: "target",
    displayName: "Sales Manager",
    email: "sales@example.invalid",
    status: "ACTIVE",
    version: 4,
    mustChangePassword: false,
    createdAt: "2026-09-09T10:00:00Z",
    branch: { publicId: "branch", code: "HQ", name: "Head Office" },
    client: null,
    roles: ["SALES_MANAGER", "OPS_MANAGER", "VERIFIER"].map((code) => ({ code, name: code })),
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (path === "/auth/me")
      return reply({
        id: "admin",
        tenantId: "test",
        tenantName: "Test Workspace",
        displayName: "Administrator",
        email: "admin@example.invalid",
        roles: ["PLATFORM_ADMIN"],
        permissions: ["*"],
        mustChangePassword: false,
      });
    if (path === "/users/target" && route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      if (controls.hold) await gate;
      if (controls.fail)
        return reply({ status: 409, detail: "User changed; refresh and try again" }, 409);
      user.roles = (body.roleCodes as string[]).map((code) => ({ code, name: code }));
      user.version++;
      return reply({ id: user.id, roleCodes: body.roleCodes, version: user.version });
    }
    if (path === "/users") return reply({ items: [user], total: 1, page: 1, pageSize: 10 });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/dashboards/navigation") return reply({ counts: {} });
    if (path === "/clients" || path === "/settings/branches")
      return reply({ items: [], total: 0, page: 1, pageSize: 100 });
    return reply({ status: 501, detail: `Unexpected ${path}` }, 501);
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Actions for Sales Manager" }).click();
  await page.getByRole("menuitem", { name: "Edit roles", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit role access" })).toBeVisible();
  return {
    requests,
    controls,
    dialog,
    hold() {
      controls.hold = true;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    release() {
      controls.hold = false;
      release();
    },
  };
}

test("admin can retain only Sales Manager, with one save and unchanged scope", async ({ page }) => {
  const setup = await fixture(page);
  const dialog = setup.dialog;
  await dialog.getByRole("radio", { name: "Single role", exact: true }).check();
  await expect(dialog.getByRole("button", { name: "Save roles" })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "Sales Manager", exact: true }).check();
  await expect(
    dialog.getByText("Remove: Operations Manager, Verifier", { exact: true }),
  ).toBeVisible();
  setup.hold();
  const save = dialog.getByRole("button", { name: "Save roles" });
  await save.click();
  await expect(save).toHaveAttribute("aria-busy", "true");
  await save.dispatchEvent("click");
  await expect.poll(() => setup.requests.length).toBe(1);
  setup.release();
  await expect(dialog).toHaveCount(0);
  expect(setup.requests[0]).toEqual({
    version: 4,
    roleCodes: ["SALES_MANAGER"],
    additionalAccessConfirmed: false,
  });
});

test("removing one additional role requires confirmation of remaining combined access", async ({
  page,
}) => {
  const { dialog, requests } = await fixture(page);
  await dialog.getByRole("checkbox", { name: "Verifier", exact: true }).uncheck();
  await expect(dialog.getByRole("button", { name: "Save roles" })).toBeDisabled();
  await dialog.getByRole("checkbox", { name: "I confirm this person needs" }).check();
  await dialog.getByRole("button", { name: "Save roles" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests[0]?.roleCodes).toEqual(["SALES_MANAGER", "OPS_MANAGER"]);
  expect(requests[0]?.additionalAccessConfirmed).toBe(true);
});

test("stale role changes remain visible as errors without pretending the save succeeded", async ({
  page,
}) => {
  const setup = await fixture(page);
  setup.controls.fail = true;
  await setup.dialog.getByRole("radio", { name: "Single role", exact: true }).check();
  await setup.dialog.getByRole("checkbox", { name: "Sales Manager", exact: true }).check();
  await setup.dialog.getByRole("button", { name: "Save roles" }).click();
  await expect(setup.dialog.getByRole("alert")).toContainText("User changed");
  await expect(setup.dialog.getByRole("button", { name: "Save roles" })).toBeEnabled();
  await expect(
    setup.dialog.getByRole("checkbox", { name: "Client Admin", exact: true }),
  ).toBeDisabled();
});

test("mobile edit dialog fits screen; cancel does not change access", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  const setup = await fixture(page);
  const box = await setup.dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(720);
  await expect(setup.dialog.getByRole("button", { name: "Save roles" })).toBeInViewport();
  await setup.dialog.getByRole("button", { name: "Cancel" }).click();
  expect(setup.requests).toHaveLength(0);
});
