import { expect, request, test, type APIResponse } from "@playwright/test";

const enabled = process.env.E2E_FORCED_PASSWORD_FLOW === "true";
const tenantCode = process.env.E2E_TENANT_CODE;
const email = process.env.E2E_ADMIN_EMAIL;
const temporaryPassword = process.env.E2E_ADMIN_PASSWORD;
const newPassword = process.env.E2E_ADMIN_NEW_PASSWORD;
const apiUrl = `${(process.env.E2E_API_URL ?? "http://127.0.0.1:4100/api/v1").replace(/\/+$/, "")}/`;
const browserOrigin = process.env.E2E_BASE_URL ?? "http://localhost:8080";

test("temporary-password accounts cannot bypass server-side password setup", async () => {
  test.skip(!enabled, "Set E2E_FORCED_PASSWORD_FLOW=true to verify forced password setup");
  if (!tenantCode || !email || !temporaryPassword || !newPassword) {
    throw new Error("Forced-password E2E credentials are required");
  }
  if (!email.toLowerCase().endsWith("@e2e.invalid")) {
    throw new Error("Forced-password E2E may only mutate a disposable @e2e.invalid account");
  }

  const api = await request.newContext({
    baseURL: apiUrl,
    extraHTTPHeaders: { origin: browserOrigin },
  });
  try {
    await expectStatus(
      await api.post("auth/login", {
        data: { tenantCode, email, password: temporaryPassword },
      }),
      201,
    );
    const profile = await expectJson<{ mustChangePassword: boolean }>(
      await api.get("auth/me"),
      200,
    );
    expect(profile.mustChangePassword).toBe(true);

    const blocked = await expectJson<{ detail?: string }>(await api.get("clients"), 403);
    expect(blocked).toMatchObject({
      detail: expect.stringContaining("temporary password"),
    });

    await expectStatus(
      await api.post("auth/change-password", {
        headers: { "idempotency-key": `forced-password:${crypto.randomUUID()}` },
        data: { currentPassword: temporaryPassword, newPassword },
      }),
      201,
    );
    await expectStatus(await api.get("auth/me"), 401);

    await expectStatus(
      await api.post("auth/login", {
        data: { tenantCode, email, password: newPassword },
      }),
      201,
    );
    const updated = await expectJson<{ mustChangePassword: boolean }>(
      await api.get("auth/me"),
      200,
    );
    expect(updated.mustChangePassword).toBe(false);
    await expectStatus(await api.get("clients"), 200);
  } finally {
    await api.dispose();
  }
});

async function expectJson<T>(response: APIResponse, status: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), text.slice(0, 800)).toBe(status);
  return JSON.parse(text) as T;
}

async function expectStatus(response: APIResponse, status: number): Promise<void> {
  const text = await response.text();
  expect(response.status(), text.slice(0, 800)).toBe(status);
}
