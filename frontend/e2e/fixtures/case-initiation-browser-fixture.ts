import { expect, type Page } from "@playwright/test";

// Browser-only workflow fixture: no real cases, invitations or shared DB writes.
export async function caseInitiationFixture(page: Page, failAccess = false) {
  const writes: string[] = [];
  const unexpected: string[] = [];
  let releaseAccess = () => {};
  const accessGate = new Promise<void>((resolve) => {
    releaseAccess = resolve;
  });
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
      return reply(
        {
          id: "case-test",
          caseNumber: "SG-20260909-TEST123456",
          status: "CONSENT_PENDING",
          consentDelivery: {
            consentId: "consent-test",
            expiresAt: "2026-09-09T20:00:00Z",
            developmentOtp: "246810",
          },
        },
        201,
      );
    }
    if (path === "/cases/case-test/candidate-access" && request.method() === "POST") {
      writes.push(path);
      await accessGate;
      if (failAccess)
        return reply(
          { detail: `Access delivery is unavailable. ${"LongDiagnosticReference".repeat(12)}` },
          503,
        );
      return reply(
        {
          id: "access-test",
          token: "long-test-token-".repeat(24),
          expiresAt: "2026-09-23T20:00:00Z",
          delivery: { queued: false },
        },
        201,
      );
    }
    unexpected.push(`${request.method()} ${path}`);
    return reply({ detail: "Unexpected test request" }, 501);
  });
  await page.goto("/client-portal/verifications");
  await page.getByRole("button", { name: "New verification", exact: true }).click();
  return { writes, unexpected, releaseAccess };
}
