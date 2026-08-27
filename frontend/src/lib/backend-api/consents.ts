import { apiRequest } from "./client";

export interface PublicConsent {
  id: string;
  status: string;
  purpose: string;
  noticeVersion: string;
  acceptedAt?: string | null;
  withdrawnAt?: string | null;
  caseNumber: string;
  candidateName: string;
  requestedBy: string;
}

export function getPublicConsent(consentId: string) {
  return apiRequest<PublicConsent>(`/public/consents/${consentId}`);
}

export function confirmConsent(consentId: string, otp: string) {
  return apiRequest<{ accepted: true; acceptedAt: string }>(
    `/public/consents/${consentId}/confirm`,
    { method: "POST", body: JSON.stringify({ otp }) },
  );
}

export function requestConsent(caseId: string) {
  return apiRequest<{ consentId: string; expiresAt: string; developmentOtp?: string }>(
    `/cases/${caseId}/consent/request`,
    { method: "POST" },
  );
}
