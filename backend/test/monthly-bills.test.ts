import assert from "node:assert/strict";
import { test } from "node:test";
import type { Actor } from "../src/common/auth/actor";
import type { PrismaService } from "../src/database/prisma.service";
import type { BillingAnnexureService } from "../src/finance/billing-annexure.service";
import {
  amountInWords,
  buyerState,
  financialYear,
  splitTax,
} from "../src/finance/gst";
import {
  MonthlyBillService,
  istMonth,
} from "../src/finance/monthly-bill.service";
import { taxInvoiceModel } from "../src/finance/tax-invoice-model";

const finance = {
  tenantId: 1n,
  userId: 5n,
  roles: ["FINANCE_MANAGER"],
} as unknown as Actor;

void test("amounts in words follow the Indian system, as on the sample invoice", () => {
  assert.equal(
    amountInWords(12_367_800),
    "INR One Lakh Twenty Three Thousand Six Hundred Seventy Eight Only",
  );
  assert.equal(
    amountInWords(1_886_616),
    "INR Eighteen Thousand Eight Hundred Sixty Six and Sixteen paise Only",
  );
  assert.equal(
    amountInWords(1_250_000_000),
    "INR One Crore Twenty Five Lakh Only",
  );
});

void test("GST splits into CGST and SGST in Uttar Pradesh, IGST outside it", () => {
  assert.deepEqual(buyerState("09AAICV2393Q1ZE"), {
    code: "09",
    name: "Uttar Pradesh",
    intraState: true,
  });
  assert.equal(buyerState("07AABCH1234K1Z2").intraState, false);
  // No GSTIN: billed within the seller's state.
  assert.equal(buyerState(null).intraState, true);
  assert.deepEqual(splitTax(1_886_616, true), {
    cgst: 943_308,
    sgst: 943_308,
    igst: 0,
  });
  assert.deepEqual(splitTax(1_886_617, false), {
    cgst: 0,
    sgst: 0,
    igst: 1_886_617,
  });
  // April starts the financial year.
  assert.equal(financialYear(new Date("2026-03-31T10:00:00Z")), "25-26");
  assert.equal(financialYear(new Date("2026-04-01T10:00:00Z")), "26-27");
});

void test("the tax invoice groups cases of one package and shows the round-off", () => {
  const line = (description: string, unitPrice: number) => ({
    description,
    quantity: 1,
    unitPrice,
    taxRate: 18,
    report: { releasedAt: new Date("2026-10-15T06:00:00Z") },
  });
  const model = taxInvoiceModel({
    invoiceNumber: "SG/26-27/0001",
    status: "ISSUED",
    issuedAt: new Date("2026-11-01T06:00:00Z"),
    createdAt: new Date("2026-11-01T06:00:00Z"),
    subtotal: 6234.5,
    taxAmount: 1122.21,
    totalAmount: 7357,
    client: {
      legalName: "Varahe Analytics",
      displayName: "Varahe",
      gstin: "09AAICV2393Q1ZE",
    },
    lines: [
      line("Background Verification - Standard", 2500),
      line("Background Verification - Standard", 2500),
      line("Court Record Verification", 1234.5),
    ],
  });
  assert.equal(model.title, "Tax Invoice");
  assert.deepEqual(
    model.rows.map((row) => [
      row.particulars,
      row.quantity,
      row.amount,
      row.period,
    ]),
    [
      ["Background Verification - Standard", 2, 500_000, "Oct-26"],
      ["Court Record Verification", 1, 123_450, "Oct-26"],
    ],
  );
  assert.deepEqual(
    model.taxRows.map((row) => [row.label, row.rate]),
    [
      ["CGST Output", "9%"],
      ["SGST Output", "9%"],
    ],
  );
  assert.equal(model.totals.cgst + model.totals.sgst, 112_221);
  assert.equal(model.roundOff, 29);
  assert.equal(model.dated, "01-Nov-26");
});

void test("the month runs on Indian time", () => {
  const { from, to } = istMonth("2026-10");
  assert.equal(from.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(to.toISOString(), "2026-10-31T18:30:00.000Z");
});

function issueFixture(bill: Record<string, unknown>) {
  const writes: Array<Record<string, unknown>> = [];
  const audits: string[] = [];
  const tx = {
    invoice: {
      findFirst: () => ({ invoiceNumber: "SG/26-27/0007" }),
      updateMany: (args: { data: Record<string, unknown> }) => {
        writes.push(args.data);
        return { count: 1 };
      },
    },
    auditEvent: {
      create: (args: { data: { action: string } }) =>
        audits.push(args.data.action),
    },
    user: { findMany: () => [{ id: 70n }] },
    notification: { createMany: () => ({ count: 1 }) },
  };
  const prisma = {
    invoice: {
      findFirst: () => ({
        id: 9n,
        clientId: 3n,
        status: "DRAFT",
        version: 2,
        invoiceNumber: "BILL-2026-10-VARAHE",
        annexureStatus: "VALIDATED",
        totalAmount: 7357,
        client: { displayName: "Varahe" },
        ...bill,
      }),
    },
    $transaction: (work: (client: typeof tx) => unknown) => work(tx),
  } as unknown as PrismaService;
  const service = new MonthlyBillService(prisma, {} as BillingAnnexureService);
  return { service, writes, audits };
}

void test("Finance issues a tax invoice only after the company validates the bill", async () => {
  const waiting = issueFixture({ annexureStatus: "PENDING" });
  await assert.rejects(
    waiting.service.issue(finance, "inv-1", { version: 2 }),
    /after the company validates/,
  );
  const queried = issueFixture({ annexureStatus: "QUERIED" });
  await assert.rejects(
    queried.service.issue(finance, "inv-1", { version: 2 }),
    /validates/,
  );

  const { service, writes, audits } = issueFixture({});
  const result = await service.issue(finance, "inv-1", { version: 2 });
  // The next number of the financial year's GST series.
  assert.match(result.invoiceNumber, /^SG\/\d{2}-\d{2}\/0008$/);
  assert.equal(writes[0]!.status, "ISSUED");
  assert.equal(writes[0]!.invoiceNumber, result.invoiceNumber);
  assert.deepEqual(audits, ["finance.invoice.issued"]);
  // Due 30 days after issue unless Finance sets a date.
  const days =
    (result.dueAt.getTime() - result.issuedAt.getTime()) / 86_400_000;
  assert.equal(days, 30);
});

void test("an issued bill cannot be issued again", async () => {
  const { service } = issueFixture({ status: "ISSUED" });
  await assert.rejects(
    service.issue(finance, "inv-1", { version: 2 }),
    /already issued/,
  );
});
