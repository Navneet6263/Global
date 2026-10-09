import { apiRequest } from "./client";

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
