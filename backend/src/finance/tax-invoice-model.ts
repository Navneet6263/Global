import { INVOICE_SELLER } from "../common/company-details";
import { toPaise } from "./finance.shared";
import { amountInWords, buyerState, periodLabel, splitTax } from "./gst";

export interface TaxInvoiceSource {
  invoiceNumber: string;
  status: string;
  issuedAt: Date | null;
  createdAt: Date;
  subtotal: unknown;
  taxAmount: unknown;
  totalAmount: unknown;
  client: {
    legalName: string;
    displayName: string;
    gstin?: string | null;
    billingAddress?: string | null;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: unknown;
    taxRate: unknown;
    report?: { releasedAt: Date | null } | null;
  }>;
}

export interface TaxInvoiceRow {
  particulars: string;
  detail: string;
  sac: string;
  period: string;
  quantity: number;
  /** Paise per unit. */
  rate: number;
  /** Paise. */
  amount: number;
}

export interface TaxSummaryRow {
  taxable: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

/** Everything the tax invoice prints, worked out in paise so the totals always agree. */
export function taxInvoiceModel(source: TaxInvoiceSource) {
  const draft = source.status === "DRAFT";
  const dated = source.issuedAt ?? source.createdAt;
  const state = buyerState(source.client.gstin);
  // Billing period: the months the reports were released in, else the invoice date.
  const released = source.lines
    .map((line) => line.report?.releasedAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  const months = [...new Set(released.map(periodLabel))];
  const period =
    months.length > 1
      ? `${months[0]} to ${months.at(-1)}`
      : (months[0] ?? periodLabel(dated));

  // One row per service and price: several cases of the same package are one line.
  const groups = new Map<string, TaxInvoiceRow & { taxRate: number }>();
  for (const line of source.lines) {
    const rate = toPaise(line.unitPrice);
    const taxRate = Number(line.taxRate);
    const key = `${line.description}|${rate}|${taxRate}`;
    const row = groups.get(key) ?? {
      particulars: line.description,
      detail: "",
      sac: INVOICE_SELLER.sac,
      period,
      quantity: 0,
      rate,
      amount: 0,
      taxRate,
    };
    row.quantity += line.quantity;
    row.amount += rate * line.quantity;
    groups.set(key, row);
  }
  const rows = [...groups.values()].map((row) => ({
    ...row,
    detail: `${row.quantity} ${row.quantity === 1 ? "case" : "cases"} as per the billing annexure`,
  }));

  // Tax per rate, the same way the invoice was priced (each line rounded to the paisa).
  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const line of source.lines) {
    const base = toPaise(line.unitPrice) * line.quantity;
    const rate = Number(line.taxRate);
    const entry = byRate.get(rate) ?? { taxable: 0, tax: 0 };
    entry.taxable += base;
    entry.tax += Math.round((base * rate) / 100);
    byRate.set(rate, entry);
  }
  const summary: TaxSummaryRow[] = [...byRate.entries()]
    .filter(([, entry]) => entry.taxable > 0)
    .map(([rate, entry]) => ({
      taxable: entry.taxable,
      rate,
      ...splitTax(entry.tax, state.intraState),
    }));
  const taxable = toPaise(source.subtotal);
  const tax = toPaise(source.taxAmount);
  const total = toPaise(source.totalAmount);
  const totals = summary.reduce(
    (sum, row) => ({
      cgst: sum.cgst + row.cgst,
      sgst: sum.sgst + row.sgst,
      igst: sum.igst + row.igst,
    }),
    { cgst: 0, sgst: 0, igst: 0 },
  );
  const halfRate = (rate: number) => rate / 2;
  const mainRate = summary[0]?.rate ?? 0;
  const taxRows = state.intraState
    ? [
        {
          label: "CGST Output",
          rate: `${halfRate(mainRate)}%`,
          amount: totals.cgst,
        },
        {
          label: "SGST Output",
          rate: `${halfRate(mainRate)}%`,
          amount: totals.sgst,
        },
      ]
    : [{ label: "IGST Output", rate: `${mainRate}%`, amount: totals.igst }];

  return {
    draft,
    title: draft ? "Proforma Invoice" : "Tax Invoice",
    note: draft
      ? "Draft for the client's validation. This is not a tax invoice."
      : "",
    invoiceNumber: source.invoiceNumber,
    dated: dateLabel(dated),
    buyer: {
      name: source.client.legalName || source.client.displayName,
      address: source.client.billingAddress?.trim() ?? "",
      gstin: source.client.gstin?.trim() || "Unregistered",
      stateName: state.name,
      stateCode: state.code,
    },
    intraState: state.intraState,
    rows,
    taxRows: taxRows.filter((row) => row.amount > 0),
    /** Positive adds, negative reduces ("Less : SHORT & EXCESS"). */
    roundOff: total - (taxable + tax),
    taxable,
    tax,
    total,
    summary,
    totals,
    words: amountInWords(total),
    taxWords: amountInWords(tax),
  };
}

export type TaxInvoice = ReturnType<typeof taxInvoiceModel>;

/** "28-Sep-26", as in the sample. */
export function dateLabel(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}-${part("month")}-${part("year")}`;
}

/** 1,23,678.00 (Indian grouping, two decimals). */
export function rupees(paise: number) {
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
