import { apiDownload, apiRequest, saveBlob } from "./client";

export interface RmPaymentClient {
  clientId: string;
  clientName: string;
  outstanding: number;
  overdue: number;
  /** Released reports not on an invoice yet (Finance bills them at month end). */
  unbilledReports: number;
  lastReminderAt: string | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    /** Optimistic lock for recording a payment. */
    version: number;
    total: number;
    paid: number;
    dueAt: string | null;
    balance: number;
    overdue: boolean;
    billValidation: "PENDING" | "VALIDATED" | "QUERIED" | null;
  }>;
}

export const getRmPayments = () =>
  apiRequest<{
    items: RmPaymentClient[];
    totals: { outstanding: number; overdue: number; unbilledReports: number };
  }>("/rm/payments");

export const sendPaymentReminder = (clientId: string, note?: string) =>
  apiRequest<{ clientId: string; outstanding: number; clientAdmins: number }>(
    `/rm/payments/${clientId}/remind`,
    { method: "POST", body: JSON.stringify(note ? { note } : {}) },
  );

export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CARD" | "OTHER";

/** Money received from the company against one of its invoices (audited; Finance notified). */
export const recordRmPayment = (
  invoiceId: string,
  input: {
    amount: number;
    method: PaymentMethod;
    reference?: string;
    receivedAt: string;
    version: number;
  },
) =>
  apiRequest<{ id: string; status: string }>(`/rm/payments/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });

export async function downloadRmInvoice(invoiceId: string, invoiceNumber: string) {
  const blob = await apiDownload(`/rm/payments/invoices/${invoiceId}/pdf`);
  saveBlob(blob, `${invoiceNumber.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`);
}
