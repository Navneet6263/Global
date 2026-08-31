import { apiDownload, apiRequest, saveBlob } from "./client";
import { fileSha256 } from "./file-digest";

export const documentTypes = [
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "EMPLOYMENT_PROOF",
  "OTHER",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export function createDocument(caseId: string, type: DocumentType) {
  return apiRequest<{ id: string; type: string; status: string; currentVersion: number }>(
    `/cases/${caseId}/documents`,
    { method: "POST", body: JSON.stringify({ type }) },
  );
}

export async function uploadDocument(documentId: string, file: File) {
  const body = new FormData();
  body.append("file", file, file.name);
  const digest = await fileSha256(file);
  return apiRequest<{ version: number; sha256: string; malwareState: string }>(
    `/documents/${documentId}/content`,
    { method: "POST", headers: { "x-content-sha256": digest }, body },
  );
}

export async function downloadDocument(documentId: string, filename: string) {
  const blob = await apiDownload(`/documents/${documentId}/content`);
  saveBlob(blob, filename);
}
