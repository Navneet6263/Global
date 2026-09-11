import type { Page } from "@playwright/test";

export async function financeBrowserFixture(page: Page, canWrite = true) {
  const requests: string[] = [];
  const unexpected: string[] = [];
  const invoice = {
    id: "invoice-test",
    invoiceNumber: "INV-TEST-001",
    status: "OVERDUE",
    currency: "INR",
    subtotal: 1000,
    taxAmount: 180,
    totalAmount: 1180,
    paidAmount: 0,
    creditedAmount: 0,
    version: 1,
    dueAt: "2026-09-01T00:00:00Z",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    client: { publicId: "client-test", displayName: "Test Organisation", code: "TEST" },
    lines: [],
    payments: [],
    creditNotes: [],
  };
  let hold: Promise<void> | undefined;
  let release = () => {};
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    requests.push(`${route.request().method()} ${path}${url.search}`);
    const reply = (data: unknown) => route.fulfill({ json: data });
    if (path === "/auth/me")
      return reply({
        id: "finance-test",
        tenantId: "tenant-test",
        tenantName: "Test Workspace",
        displayName: "Test Finance",
        email: "finance@example.invalid",
        roles: ["FINANCE_MANAGER"],
        permissions: ["finance:read", "notification:read", ...(canWrite ? ["finance:write"] : [])],
        mustChangePassword: false,
      });
    if (path === "/notifications") return reply({ items: [], unreadCount: 0 });
    if (path === "/finance/overview")
      return reply({
        summary: {
          invoiceCount: 1,
          openInvoiceCount: 1,
          billed: 1180,
          collected: 0,
          credited: 0,
          outstanding: 1180,
          overdueAmount: 1180,
          overdueCount: 1,
        },
        ageing: [{ label: "1–30 days", value: 1180 }],
        generatedAt: new Date().toISOString(),
      });
    if (path === "/finance/invoices") {
      await hold;
      return reply({ items: url.searchParams.get("search") ? [] : [invoice], nextCursor: null });
    }
    if (path === "/finance/billing-ready") return reply({ items: [], nextCursor: null });
    if (path === "/finance/credit-control") return reply({ items: [], total: 0 });
    unexpected.push(path);
    return route.fulfill({ status: 501, json: { title: `Unexpected ${path}` } });
  });
  return {
    requests,
    unexpected,
    pauseInvoices() {
      hold = new Promise<void>((resolve) => {
        release = resolve;
      });
    },
    resumeInvoices() {
      release();
      hold = undefined;
    },
  };
}
