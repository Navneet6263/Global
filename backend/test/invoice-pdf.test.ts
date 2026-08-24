import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { InvoicePdfService } from "../src/finance/invoice-pdf.service";

void test("invoice renderer produces a paginated PDF with invoice metadata", async () => {
  const result = await new InvoicePdfService().render({
    invoiceNumber: "SG-20260820-A1B2C3",
    status: "ISSUED",
    currency: "INR",
    issuedAt: new Date("2026-08-20T08:00:00Z"),
    dueAt: new Date("2026-09-19T08:00:00Z"),
    subtotal: 5000,
    taxAmount: 900,
    totalAmount: 5900,
    paidAmount: 0,
    notes: "Payment is due according to the agreed billing terms.",
    createdAt: new Date("2026-08-20T08:00:00Z"),
    client: {
      legalName: "Enterprise Client Private Limited",
      displayName: "Enterprise Client",
      code: "ENTERPRISE",
      billingTerms: "Net 30",
    },
    lines: [
      {
        description: "Background verification services",
        quantity: 2,
        unitPrice: 2500,
        taxRate: 18,
        lineTotal: 5900,
        case: { caseNumber: "SG-20260820-000001" },
      },
    ],
    payments: [],
  });

  assert.equal(result.subarray(0, 5).toString(), "%PDF-");
  assert.ok(result.length > 1500);
  const document = await PDFDocument.load(result);
  assert.equal(
    document.getTitle(),
    "Sapling Global invoice SG-20260820-A1B2C3",
  );
  assert.equal(document.getPageCount(), 1);
});
