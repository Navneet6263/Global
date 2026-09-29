import { apiDownload, apiRequest } from "@/lib/backend-api/client";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import type {
  VendorDecisionInput,
  VendorRequestDetail,
  VendorRequestPage,
  VendorRequestQuery,
  VendorRequestStatus,
} from "./vendor-contracts";

const id = (value: string) => encodeURIComponent(value);

function listPath(query: VendorRequestQuery): string {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  return `/vendor/requests?${params.toString()}`;
}

/** Vendor workspace API (/vendor/requests): only the signed-in vendor's own requests. */
export const vendorApi = {
  list: (query: VendorRequestQuery, signal?: AbortSignal) =>
    apiRequest<VendorRequestPage>(listPath(query), { signal }),
  detail: (requestId: string, signal?: AbortSignal) =>
    apiRequest<VendorRequestDetail>(`/vendor/requests/${id(requestId)}`, { signal }),
  decide: (input: VendorDecisionInput) =>
    apiRequest<{ id: string; status: VendorRequestStatus; version: number }>(
      `/vendor/requests/${id(input.requestId)}/decision`,
      {
        method: "POST",
        body: JSON.stringify({
          decision: input.decision,
          reason: input.reason || undefined,
          version: input.version,
        }),
      },
    ),
  preview: (requestId: string) =>
    openDocumentPreview(() => apiDownload(`/vendor/requests/${id(requestId)}/preview`)),
};
