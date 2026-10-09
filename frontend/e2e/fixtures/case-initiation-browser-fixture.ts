import { expect, type Page } from "@playwright/test";

// Browser-only workflow fixture: no real cases, invitations or shared DB writes.
export async function caseInitiationFixture(page: Page) {
  const writes: string[] = [];
  const payloads: Array<{ path: string; body: unknown }> = [];
  const unexpected: string[] = [];
  await page.addInitScript(() => {
    const copied: string[] = [];
    Object.defineProperty(window, "testCopiedValues", { value: copied });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied.push(value);
        },
      },
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path === "/auth/me")
      return reply({
        id: "client-test-user",
        tenantId: "tenant-test",
        tenantName: "Browser test workspace",
        displayName: "Test Client",
        email: "client@example.invalid",
        roles: ["CLIENT_ADMIN"],
        permissions: ["case:read", "case:create", "notification:read"],
        mustChangePassword: false,
        clientId: "00000000-0000-4000-8000-000000000001",
        clientName: "Test requesting organisation",
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0, nextCursor: null });
    if (path === "/client-account/relationship-manager")
      return reply({
        rm: {
          name: "Niku Sharma",
          email: "niku@saplingglobal.example",
          phone: "+919876543210",
          since: "2026-10-07T10:00:00Z",
        },
      });
    if (path === "/dashboards/navigation")
      return reply({ counts: {}, generatedAt: new Date().toISOString() });
    if (path === "/cases/catalog")
      return reply({
        items: [
          {
            id: "package-test",
            code: "STANDARD",
            name: "Standard BGV",
            checks: ["IDENTITY", "ADDRESS"],
            serviceFamily: "BGV",
            requiredDocuments: [],
            price: 2500,
            taxRate: 18,
            tatHours: 72,
          },
        ],
      });
    if (path === "/cases" && request.method() === "GET")
      return reply({ items: [], nextCursor: null, total: 0, page: 1, pageSize: 25 });
    if (path === "/cases" && request.method() === "POST") {
      expect(request.postDataJSON()).toMatchObject({
        clientId: "00000000-0000-4000-8000-000000000001",
        fullName: "Layout Test Candidate",
        servicePackageId: "package-test",
      });
      writes.push(path);
      payloads.push({ path, body: request.postDataJSON() });
      return reply(
        {
          id: "case-test",
          caseNumber: "SG-20260909-TEST123456",
          status: "CONSENT_PENDING",
          candidateAccess: {
            id: "access-test",
            token: "long-test-token-".repeat(24),
            expiresAt: "2026-09-23T20:00:00Z",
            delivery: { queued: true, channel: "EMAIL", destination: "ca***@example.invalid" },
          },
        },
        201,
      );
    }
    unexpected.push(`${request.method()} ${path}`);
    return reply({ detail: "Unexpected test request" }, 501);
  });
  await page.goto("/client-portal/verifications");
  await page.getByRole("button", { name: "New verification", exact: true }).click();
  return { writes, unexpected, payloads };
}
