import { apiRequest } from "./client";

export interface CandidatePortalData {
  id: string;
  expiresAt: string;
  case: {
    caseNumber: string;
    status: string;
    candidateName: string;
    clientName: string;
    dueAt?: string | null;
    checks: Array<{ type: string; status: string }>;
    documents: Array<{ type: string; status: string; currentVersion: number }>;
    clarifications: Array<{
      id: string;
      subject: string;
      status: string;
      dueAt?: string | null;
      messages: Array<{ sender: string; body: string; createdAt: string }>;
    }>;
    consentStatus: string;
    reportAvailable: boolean;
  };
}

export type CandidateCase = CandidatePortalData["case"];

export function issueCandidateAccess(caseId: string) {
  return apiRequest<{ id: string; token: string; expiresAt: string }>(
    `/cases/${caseId}/candidate-access`,
    { method: "POST" },
  );
}

export function getCandidatePortal(accessId: string, token: string) {
  return apiRequest<CandidatePortalData>(`/public/candidate-access/${accessId}`, {
    headers: { "x-portal-token": token },
  });
}

export function uploadCandidateDocument(accessId: string, token: string, type: string, file: File) {
  const body = new FormData();
  body.append("file", file, file.name);
  return apiRequest<{ id: string; type: string; version: number; sha256: string }>(
    `/public/candidate-access/${accessId}/documents`,
    { method: "POST", headers: { "x-portal-token": token, "x-document-type": type }, body },
  );
}

export function respondToCandidateClarification(
  accessId: string,
  token: string,
  clarificationId: string,
  message: string,
) {
  return apiRequest<{ received: true; respondedAt: string }>(
    `/public/candidate-access/${accessId}/clarifications/${clarificationId}/respond`,
    {
      method: "POST",
      headers: { "x-portal-token": token },
      body: JSON.stringify({ message }),
    },
  );
}
