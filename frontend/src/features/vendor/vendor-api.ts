import { apiDownload, apiRequest, saveBlob } from "@/lib/backend-api/client";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import { fileSha256 } from "@/lib/backend-api/file-digest";
import type {
  VendorReport,
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
  /** Main Vendor: hand a pending request to a team user (null = keep it yourself). */
  delegate: (requestId: string, handlerId: string | null, version: number) =>
    apiRequest<{ id: string; version: number; handler: { id: string; name: string } | null }>(
      `/vendor/requests/${id(requestId)}/delegate`,
      { method: "POST", body: JSON.stringify({ handlerId, version }) },
    ),
  remind: (requestId: string) =>
    apiRequest<{ id: string; remindedAt: string; handler: string }>(
      `/vendor/requests/${id(requestId)}/remind`,
      { method: "POST" },
    ),
  /** PDF or PNG, at most 2 MB, on an APPROVED request; the server re-checks everything. */
  uploadReport: async (requestId: string, file: File) => {
    const body = new FormData();
    body.append("file", file, file.name);
    // Multipart writes must carry the file's SHA-256; the server re-hashes and compares.
    const digest = await fileSha256(file);
    return apiRequest<VendorReport>(`/vendor/requests/${id(requestId)}/report`, {
      method: "POST",
      headers: { "x-content-sha256": digest },
      body,
    });
  },
  previewReport: (requestId: string) =>
    openDocumentPreview(() => apiDownload(`/vendor/requests/${id(requestId)}/report?mode=preview`)),
  downloadReport: async (requestId: string, filename: string) =>
    saveBlob(await apiDownload(`/vendor/requests/${id(requestId)}/report?mode=download`), filename),
  preview: (requestId: string) =>
    openDocumentPreview(() => apiDownload(`/vendor/requests/${id(requestId)}/preview`)),
};
