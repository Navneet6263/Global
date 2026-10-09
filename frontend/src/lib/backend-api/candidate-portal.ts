import { apiRequest } from "./client";

export interface CandidatePortalData {
  id: string;
  expiresAt: string;
  /** Set once the candidate pressed Complete; the link is then closed for changes. */
  completedAt?: string | null;
  privacyNotice: { version: string; title: string; paragraphs: string[] };
  case: {
    caseNumber: string;
    status: string;
    candidateName: string;
    clientName: string;
    dueAt?: string | null;
    checks: Array<{ type: string; status: string }>;
    documents: Array<{
      type: string;
      status: string;
      currentVersion: number;
      reviewNote?: string | null;
      expiresAt?: string | null;
    }>;
    requiredDocumentTypes: string[];
    /** Exactly what this candidate must upload, with its current state. */
    uploadItems: Array<{
      type: string;
      required: boolean;
      state: "NEEDED" | "UPLOADED" | "VERIFIED" | "REUPLOAD";
      reviewNote: string | null;
      version: number;
    }>;
    readyToComplete: boolean;
    clarifications: Array<{
      id: string;
      subject: string;
      status: string;
      dueAt?: string | null;
      messages: Array<{ sender: string; body: string; createdAt: string }>;
    }>;
    consentStatus: string;
    reportAvailable: boolean;
    /** The candidate's own support requests for this case, with the team's reply. */
    supportRequests: CandidateSupportRequest[];
  };
}

export interface CandidateSupportRequest {
  id: string;
  requestNumber: string;
  subject: string;
  caseNumber: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  reply: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CandidateCase = CandidatePortalData["case"];

export interface CandidateAccessResult {
  id: string;
  token: string;
  expiresAt: string;
  delivery: { queued: true; channel: "EMAIL" | "SMS"; destination: string } | { queued: false };
}

export function issueCandidateAccess(caseId: string, sendNotification = true) {
  return apiRequest<CandidateAccessResult>(`/cases/${caseId}/candidate-access`, {
    method: "POST",
    body: JSON.stringify({ sendNotification }),
  });
}

export function getCandidatePortal(accessId: string, token: string) {
  return apiRequest<CandidatePortalData>(`/public/candidate-access/${accessId}`, {
    headers: { "x-portal-token": token },
  });
}

export function uploadCandidateDocument(
  accessId: string,
  token: string,
  type: string,
  file: File,
  noticeVersion: string,
  expiresAt?: string,
) {
  const body = new FormData();
  body.append("file", file, file.name);
  return apiRequest<{ id: string; type: string; version: number; sha256: string }>(
    `/public/candidate-access/${accessId}/documents`,
    {
      method: "POST",
      headers: {
        "x-portal-token": token,
        "x-document-type": type,
        "x-privacy-notice-version": noticeVersion,
        ...(expiresAt ? { "x-document-expires-at": expiresAt } : {}),
      },
      body,
    },
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

/** "Raise a support request" from the candidate link; the server resolves the case. */
export function raiseCandidateSupportRequest(
  accessId: string,
  token: string,
  input: { subject: string; message: string },
) {
  return apiRequest<CandidateSupportRequest>(
    `/public/candidate-access/${accessId}/support-requests`,
    {
      method: "POST",
      headers: { "x-portal-token": token },
      body: JSON.stringify(input),
    },
  );
}

export function completeCandidatePortal(accessId: string, token: string) {
  return apiRequest<{ completed: true; completedAt: string }>(
    `/public/candidate-access/${accessId}/complete`,
    { method: "POST", headers: { "x-portal-token": token } },
  );
}

/** Consent inside the same link: emails a one-time code (there is no separate consent link). */
export function sendCandidateConsentCode(accessId: string, token: string) {
  return apiRequest<{
    sent: true;
    expiresAt: string;
    destination: string;
    developmentOtp?: string;
  }>(`/public/candidate-access/${accessId}/consent/otp`, {
    method: "POST",
    headers: { "x-portal-token": token },
  });
}

export function confirmCandidateConsent(accessId: string, token: string, otp: string) {
  return apiRequest<{ accepted: true; acceptedAt: string }>(
    `/public/candidate-access/${accessId}/consent/confirm`,
    {
      method: "POST",
      headers: { "x-portal-token": token },
      body: JSON.stringify({ otp }),
    },
  );
}
