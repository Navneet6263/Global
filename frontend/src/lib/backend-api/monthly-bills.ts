import { apiRequest } from "./client";

/** Where a monthly bill is: with the company to validate, validated, queried or issued. */
export interface MonthlyBill {
  id: string;
  invoiceNumber: string;
  status: string;
  version: number;
  issuedAt: string | null;
  dueAt: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  cases: number;
  validation: {
    status: "PENDING" | "VALIDATED" | "QUERIED" | null;
    sentAt: string | null;
    validatedAt: string | null;
    query: string | null;
  };
  client: { id: string; name: string; gstin: string | null };
  createdAt: string;
}

export interface PreparedBills {
  period: string;
  label: string;
  prepared: Array<{ client: string; invoiceId: string; cases: number; total: number }>;
  skipped: Array<{ client: string; caseNumber?: string; reason: string }>;
}

export const listMonthlyBills = (period: string) =>
  apiRequest<{ period: string; label: string; items: MonthlyBill[] }>(
    `/finance/monthly-bills?period=${encodeURIComponent(period)}`,
  );

/** Every company's released reports of the month become a bill sent for validation. */
export const prepareMonthlyBills = (period: string) =>
  apiRequest<PreparedBills>("/finance/monthly-bills/prepare", {
    method: "POST",
    body: JSON.stringify({ period }),
  });

/** A validated bill becomes a tax invoice with the next GST number. */
export const issueMonthlyBill = (bill: Pick<MonthlyBill, "id" | "version">, dueAt?: string) =>
  apiRequest<{ id: string; invoiceNumber: string; status: string; version: number }>(
    `/finance/monthly-bills/${bill.id}/issue`,
    {
      method: "POST",
      body: JSON.stringify({ version: bill.version, ...(dueAt ? { dueAt } : {}) }),
    },
  );
