import { apiDownload, apiRequest } from "./client";
import { openDocumentPreview } from "./document-preview";
import { fileSha256 } from "./file-digest";

export interface CheckEvidenceFile {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  caption: string | null;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface CheckEvidenceList {
  checkId: string;
  canEdit: boolean;
  maxFiles: number;
  maxBytes: number;
  items: CheckEvidenceFile[];
}

const base = (checkId: string) => `/checks/${encodeURIComponent(checkId)}/evidence`;

/** Proof for a check's report annexure: screenshots, replies, photos, lab reports. */
export const checkEvidenceApi = {
  list: (checkId: string) => apiRequest<CheckEvidenceList>(base(checkId)),
  upload: async (checkId: string, file: File, caption?: string) => {
    const body = new FormData();
    body.append("file", file, file.name);
    const query = caption?.trim() ? `?caption=${encodeURIComponent(caption.trim())}` : "";
    return apiRequest<CheckEvidenceFile>(`${base(checkId)}${query}`, {
      method: "POST",
      headers: { "x-content-sha256": await fileSha256(file) },
      body,
    });
  },
  caption: (checkId: string, fileId: string, caption: string) =>
    apiRequest<{ id: string; caption: string | null }>(`${base(checkId)}/${fileId}`, {
      method: "PATCH",
      body: JSON.stringify({ caption }),
    }),
  remove: (checkId: string, fileId: string) =>
    apiRequest<{ removed: true }>(`${base(checkId)}/${fileId}`, { method: "DELETE" }),
  blob: (checkId: string, fileId: string) => apiDownload(`${base(checkId)}/${fileId}`),
  open: (checkId: string, fileId: string) =>
    openDocumentPreview(() => apiDownload(`${base(checkId)}/${fileId}`)),
};
