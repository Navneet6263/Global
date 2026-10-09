import { apiDownload, apiRequest, saveBlob } from "./client";
import type { Disposition } from "./rework";

export type AnnexureStatus = "PENDING" | "VALIDATED" | "QUERIED";

export interface BillingAnnexure {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    issuedAt: string | null;
    clientName: string;
    subtotal: string;
    taxAmount: string;
    totalAmount: string;
  };
  validation: {
    status: AnnexureStatus | null;
    sentAt: string | null;
    validatedAt: string | null;
    query: string | null;
    /** Sent more than 3 days ago and still not validated. */
    ageing: boolean;
  };
  colours: Record<string, number>;
  rows: Array<{
    caseNumber: string;
    candidateName: string;
    description: string;
    completedAt: string | null;
    releasedAt: string | null;
    quantity: number;
    unitPrice: string;
    taxRate: string;
    lineTotal: string;
    colour: Disposition | null;
    colourLabel: string;
  }>;
}

/** "client" = Company Admin routes; "finance" = Finance / Platform Admin routes. */
export type AnnexureAudience = "client" | "finance";
const base = (audience: AnnexureAudience, invoiceId: string) =>
  `/${audience === "client" ? "client-finance" : "finance"}/invoices/${invoiceId}/annexure`;

export const getBillingAnnexure = (audience: AnnexureAudience, invoiceId: string) =>
  apiRequest<BillingAnnexure>(base(audience, invoiceId));

export async function downloadBillingAnnexure(
  audience: AnnexureAudience,
  invoiceId: string,
  invoiceNumber: string,
) {
  const blob = await apiDownload(`${base(audience, invoiceId)}/export`);
  saveBlob(blob, `Sapling-Global-annexure-${invoiceNumber}.csv`);
}

export const sendBillingAnnexure = (invoiceId: string) =>
  apiRequest<{ annexureStatus: AnnexureStatus }>(`${base("finance", invoiceId)}/send`, {
    method: "POST",
  });

export const validateBill = (invoiceId: string) =>
  apiRequest<{ annexureStatus: AnnexureStatus }>(`${base("client", invoiceId)}/validate`, {
    method: "POST",
  });

export const queryBill = (invoiceId: string, query: string) =>
  apiRequest<{ annexureStatus: AnnexureStatus }>(`${base("client", invoiceId)}/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
