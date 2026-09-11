import { apiRequest } from "./client";
export interface BillingReadyReport {
  reportId: string;
  reportVersion: number;
  preparedAt: string;
  caseId: string;
  caseNumber: string;
  candidateName: string;
  client: { id: string; displayName: string };
  lines: Array<{
    caseId: string;
    reportId: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}
export function listBillingReady(cursor?: string) {
  const query = new URLSearchParams({ limit: "10" });
  if (cursor) query.set("cursor", cursor);
  return apiRequest<{ items: BillingReadyReport[]; nextCursor: string | null }>(
    `/finance/billing-ready?${query}`,
  );
}
