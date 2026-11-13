import { apiDownload, apiRequest, saveBlob } from "./client";
import { fileSha256 } from "./file-digest";
import { openDocumentPreview } from "./document-preview";

export const documentTypes = [
  "AADHAAR",
  "PAN",
  "PASSPORT",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "EDUCATION_CERTIFICATE",
  "EMPLOYMENT_PROOF",
  "BANK_PROOF",
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

function versionQuery(version?: number) {
  return version !== undefined ? `?version=${version}` : "";
}

export async function downloadDocument(documentId: string, filename: string, version?: number) {
  const blob = await apiDownload(`/documents/${documentId}/content${versionQuery(version)}`);
  saveBlob(blob, filename);
}

export function previewDocument(documentId: string, version?: number) {
  return openDocumentPreview(() =>
    apiDownload(`/documents/${documentId}/preview${versionQuery(version)}`),
  );
}

export function reviewDocument(
  documentId: string,
  input: {
    version: number;
    documentVersion: number;
    decision: "VERIFIED" | "REJECTED" | "REUPLOAD_REQUIRED";
    note: string;
    expiresAt?: string;
  },
) {
  return apiRequest<{
    id: string;
    status: "VERIFIED" | "REJECTED" | "REUPLOAD_REQUIRED";
    version: number;
    currentVersion: number;
    reviewNote: string;
  }>(`/documents/${documentId}/review`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type CheckDocumentState = {
  id: string;
  type: string;
  /** ACCEPTED: its form opens. TO_REVIEW: accept or reject its documents. WAITING_CANDIDATE: re-upload. */
  state: "ACCEPTED" | "TO_REVIEW" | "WAITING_CANDIDATE";
  documents: string[];
  waiting: string[];
  toReview: string[];
  /** Already sent to its verification team. */
  sentToTeam: boolean;
};

export function getEvidenceReadiness(caseId: string) {
  return apiRequest<{
    ready: boolean;
    issues: string[];
    requiredTypes: string[];
    /** Document problems only (missing, not accepted, rejected). */
    documentIssues?: string[];
    /** Each check's own document state, so Data Entry works check by check. */
    checks?: CheckDocumentState[];
  }>(`/cases/${caseId}/evidence-readiness`);
}
