import { apiDownload, apiRequest, saveBlob } from "./client";
import type { FinanceOverview } from "./finance";

export interface ClientInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  currency: string;
  totalAmount: number | string;
  paidAmount: number | string;
  creditedAmount: number | string;
  balance: number;
  issuedAt: string | null;
  dueAt: string | null;
  /** Bill validation of the billing annexure. */
  annexureStatus?: "PENDING" | "VALIDATED" | "QUERIED" | null;
}
export const getClientFinanceOverview = () =>
  apiRequest<FinanceOverview>("/client-finance/overview");
export function listClientInvoices(
  input: {
    search: string;
    status: string;
    cursor?: string;
    limit?: number;
  },
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({ limit: String(input.limit ?? 20) });
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.cursor) query.set("cursor", input.cursor);
  return apiRequest<{ items: ClientInvoice[]; nextCursor: string | null }>(
    `/client-finance/invoices?${query}`,
    { signal },
  );
}
export async function downloadClientInvoice(invoice: ClientInvoice) {
  const blob = await apiDownload(`/client-finance/invoices/${invoice.id}/pdf`);
  saveBlob(blob, `Sapling-${invoice.invoiceNumber}.pdf`);
}
