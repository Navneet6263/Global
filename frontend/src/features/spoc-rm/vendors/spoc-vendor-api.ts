import { apiDownload, apiRequest, saveBlob } from "@/lib/backend-api/client";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import { queryString } from "../api/spoc-api";
import type { SpocPage, SpocQuery } from "../contracts/spoc";
import type {
  AssignVendorInput,
  RequestReuploadInput,
  RequestReuploadResult,
  SpocVendorClientRow,
  SpocVendorDocumentDetail,
  SpocVendorDocumentsPage,
  VendorAssignmentResult,
  VendorOption,
} from "./spoc-vendor-contracts";

const id = (value: string) => encodeURIComponent(value);

/** SPOC-RM Vendors API (/spoc/vendors). Scope and allowed actions are decided by the server. */
export const spocVendorApi = {
  clients: (query: SpocQuery, signal?: AbortSignal) =>
    apiRequest<SpocPage<SpocVendorClientRow>>(`/spoc/vendors/clients${queryString(query)}`, {
      signal,
    }),
  documents: (clientId: string, query: SpocQuery, signal?: AbortSignal) =>
    apiRequest<SpocVendorDocumentsPage>(
      `/spoc/vendors/clients/${id(clientId)}/documents${queryString(query)}`,
      { signal },
    ),
  document: (documentId: string, signal?: AbortSignal) =>
    apiRequest<SpocVendorDocumentDetail>(`/spoc/vendors/documents/${id(documentId)}`, { signal }),
  vendors: (signal?: AbortSignal) =>
    apiRequest<{ items: VendorOption[] }>("/spoc/vendors/vendors", { signal }),
  save: (input: AssignVendorInput) =>
    input.mode === "assign"
      ? apiRequest<VendorAssignmentResult>(
          `/spoc/vendors/documents/${id(input.documentId)}/assignments`,
          {
            method: "POST",
            body: JSON.stringify({ vendorId: input.vendorId, note: input.note || undefined }),
          },
        )
      : apiRequest<VendorAssignmentResult>(
          `/spoc/vendors/assignments/${id(input.assignmentId)}/reassign`,
          {
            method: "POST",
            body: JSON.stringify({
              vendorId: input.vendorId,
              resolutionNote: input.resolutionNote,
              version: input.version,
            }),
          },
        ),
  /** Sends a vendor-rejected document back to the candidate (existing re-upload state). */
  requestReupload: (input: RequestReuploadInput) =>
    apiRequest<RequestReuploadResult>(
      `/spoc/vendors/documents/${id(input.documentId)}/reupload-request`,
      {
        method: "POST",
        body: JSON.stringify({ message: input.message, version: input.version }),
      },
    ),
  preview: (documentId: string) =>
    openDocumentPreview(() => apiDownload(`/spoc/vendors/documents/${id(documentId)}/preview`)),
  /** The latest report of an approved attempt; only a real download is logged for the vendor. */
  previewReport: (assignmentId: string) =>
    openDocumentPreview(() =>
      apiDownload(`/spoc/vendors/assignments/${id(assignmentId)}/report?mode=preview`),
    ),
  downloadReport: async (assignmentId: string, filename: string) =>
    saveBlob(
      await apiDownload(`/spoc/vendors/assignments/${id(assignmentId)}/report?mode=download`),
      filename,
    ),
};
