import { apiRequest } from "@/lib/backend-api/client";
export interface SharingRecord {
  id: string;
  recipient: string;
  purpose: string;
  agreementReference: string;
  scopeReference: string;
  categories: string[];
  expiresAt: string;
  status: string;
  effectiveStatus: string;
  isAuthor: boolean;
  decisionReason: string | null;
  version: number;
}
export interface SharingDraft {
  recipient: string;
  purpose: string;
  agreementReference: string;
  scopeReference: string;
  categories: string[];
  expiresAt: string;
}
export const sharingCategories = [
  "IDENTITY",
  "EDUCATION",
  "EMPLOYMENT",
  "ADDRESS",
  "BUSINESS_REGISTRATION",
  "VERIFICATION_OUTCOMES",
];
export function listSharing(page: number, search: string) {
  return apiRequest<{ items: SharingRecord[]; total: number }>(
    `/privacy-vendor-sharing?${new URLSearchParams({ page: String(page), ...(search ? { search } : {}) })}`,
  );
}
export function createSharing(input: SharingDraft) {
  return apiRequest("/privacy-vendor-sharing", { method: "POST", body: JSON.stringify(input) });
}
export function decideSharing(row: SharingRecord, status: string, reason: string) {
  return apiRequest(`/privacy-vendor-sharing/${row.id}`, {
    method: "PATCH",
    body: JSON.stringify({ version: row.version, status, reason }),
  });
}
export function sharingEvents(id: string, page: number) {
  return apiRequest<{
    total: number;
    items: Array<{
      id: string;
      action: string;
      createdAt: string;
      actor: { displayName: string } | null;
      detail: { status?: string; reason?: string } | null;
    }>;
  }>(`/privacy-vendor-sharing/${id}/events?page=${page}`);
}
