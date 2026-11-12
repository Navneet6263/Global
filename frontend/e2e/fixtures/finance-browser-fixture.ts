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
  const bill = (id: string, client: string, validation: string | null) => ({
    id,
    invoiceNumber: `BILL-2026-10-${client.toUpperCase().replaceAll(" ", "")}`,
    status: "DRAFT",
    version: 2,
    issuedAt: null,
    dueAt: null,
    subtotal: 5000,
    taxAmount: 900,
    totalAmount: 5900,
    cases: 2,
    validation: {
      status: validation,
      sentAt: "2026-11-01T00:00:00Z",
      validatedAt: null,
      query: null,
    },
    client: { id: `client-${id}`, name: client, gstin: "09AAICV2393Q1ZE" },
    createdAt: "2026-11-01T00:00:00Z",
  });
  const monthlyBills = [
    bill("bill-1", "Horizon Tech", "VALIDATED"),
    bill("bill-2", "Cedar Retail", "PENDING"),
  ];
  const issued: Array<Record<string, unknown>> = [];
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
    // Monthly bills: one validated bill ready to invoice, one still with the company.
    if (path === "/finance/monthly-bills")
      return reply({
        period: url.searchParams.get("period"),
        label: "October 2026",
        items: monthlyBills,
      });
    if (path === "/finance/monthly-bills/prepare")
      return reply({
        period: "2026-10",
        label: "October 2026",
        prepared: [{ client: "Cedar Retail", invoiceId: "bill-2", cases: 2, total: 5900 }],
        skipped: [
          {
            client: "Cedar Retail",
            caseNumber: "SG-OLD-1",
            reason: "No price on record for this case",
          },
        ],
      });
    if (path === "/finance/monthly-bills/bill-1/issue") {
      issued.push(JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>);
      monthlyBills[0] = {
        ...monthlyBills[0]!,
        status: "ISSUED",
        invoiceNumber: "SG/26-27/0001",
        version: 3,
      };
      return reply({ id: "bill-1", invoiceNumber: "SG/26-27/0001", status: "ISSUED", version: 3 });
    }
    if (path === "/finance/credit-control") return reply({ items: [], total: 0 });
    if (path === "/finance/invoices/invoice-test/annexure")
      return reply({
        invoice: {
          id: "invoice-test",
          invoiceNumber: "INV-TEST",
          status: "ISSUED",
          issuedAt: null,
          clientName: "Test client",
          subtotal: "1000.00",
          taxAmount: "180.00",
          totalAmount: "1180.00",
        },
        validation: { status: null, sentAt: null, validatedAt: null, query: null, ageing: false },
        colours: {},
        rows: [],
      });
    unexpected.push(path);
    return route.fulfill({ status: 501, json: { title: `Unexpected ${path}` } });
  });
  return {
    requests,
    unexpected,
    issued,
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
