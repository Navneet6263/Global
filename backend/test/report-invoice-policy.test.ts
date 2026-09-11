import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReportInvoiceCharges } from "../src/finance/report-invoice-policy";

void test("report invoices preserve every immutable service charge and tax", () => {
  const services = [
    { unitPrice: "100.00", taxRate: "18" },
    { unitPrice: "50.00", taxRate: "0" },
  ];
  assert.doesNotThrow(() =>
    assertReportInvoiceCharges(
      [
        { baseCents: 10000, taxCents: 1800 },
        { baseCents: 5000, taxCents: 0 },
      ],
      services,
    ),
  );
  assert.throws(
    () =>
      assertReportInvoiceCharges([{ baseCents: 100, taxCents: 18 }], services),
    /original case price and tax/,
  );
  assert.throws(
    () =>
      assertReportInvoiceCharges(
        [{ baseCents: 10000, taxCents: 1800 }],
        services,
      ),
    /every service/,
  );
  assert.throws(
    () =>
      assertReportInvoiceCharges([{ baseCents: 15000, taxCents: 0 }], services),
    /original case price and tax/,
  );
});

void test("zero-value report scope cannot create an unpayable or arbitrarily repriced report invoice", () => {
  const services = [{ unitPrice: 0, taxRate: 0 }];
  assert.throws(
    () => assertReportInvoiceCharges([{ baseCents: 0, taxCents: 0 }], services),
    /positive payable amount/,
  );
  assert.throws(
    () =>
      assertReportInvoiceCharges([{ baseCents: 100, taxCents: 0 }], services),
    /zero-value commercial scope/,
  );
});

void test("legacy report recovery allows explicit positive billing without retroactive package prices", () => {
  assert.doesNotThrow(() =>
    assertReportInvoiceCharges([{ baseCents: 500, taxCents: 0 }], []),
  );
  assert.throws(
    () => assertReportInvoiceCharges([{ baseCents: 0, taxCents: 0 }], []),
    /positive payable amount/,
  );
});
