import { apiDownload, apiRequest, saveBlob } from "./client";

export interface FinanceOverview {
  summary: {
    billed: number;
    collected: number;
    outstanding: number;
    overdueAmount: number;
    overdueCount: number;
  };
  ageing: Array<{ label: string; value: number }>;
  generatedAt: string;
}
export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  issuedAt?: string | null;
  dueAt?: string | null;
  subtotal: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  paidAmount: string | number;
  notes?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  client: { publicId: string; displayName: string; code: string };
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: string | number;
    taxRate: string | number;
    lineTotal: string | number;
    case?: { publicId: string; caseNumber: string } | null;
  }>;
  payments: Array<{
    publicId: string;
    amount: string | number;
    method: string;
    reference?: string | null;
    receivedAt: string;
  }>;
}

export function getFinanceOverview() {
  return apiRequest<FinanceOverview>("/finance/overview");
}
export function listInvoices(input: { status?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (input.status) query.set("status", input.status);
  if (input.search) query.set("search", input.search);
  return apiRequest<{ items: Invoice[] }>(`/finance/invoices?${query.toString()}`);
}
export function createInvoice(input: {
  clientId: string;
  dueAt: string;
  notes?: string;
  lines: Array<{
    caseId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}) {
  return apiRequest<Invoice>("/finance/invoices", { method: "POST", body: JSON.stringify(input) });
}
export function recordPayment(
  invoiceId: string,
  input: {
    amount: number;
    method: string;
    reference?: string;
    receivedAt: string;
    version: number;
  },
) {
  return apiRequest<{
    id: string;
    invoiceStatus: string;
    invoiceVersion: number;
    paidAmount: number;
  }>(`/finance/invoices/${invoiceId}/payments`, { method: "POST", body: JSON.stringify(input) });
}

export async function downloadInvoice(invoiceId: string, invoiceNumber: string) {
  const blob = await apiDownload(`/finance/invoices/${invoiceId}/pdf`);
  saveBlob(blob, `Sapling-Global-${invoiceNumber}.pdf`);
}
