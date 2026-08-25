import { apiRequest } from "./client";

export interface Clarification {
  id: string;
  status: string;
  subject: string;
  dueAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  messages: Array<{ senderType: string; body: string; createdAt: string }>;
}

export function listClarifications(caseId: string) {
  return apiRequest<{ items: Clarification[] }>(`/cases/${caseId}/clarifications`);
}

export function createClarification(
  caseId: string,
  input: { checkId?: string; subject: string; message: string; dueAt?: string },
) {
  return apiRequest<{
    id: string;
    status: string;
    subject: string;
    portalToken: string;
    tokenExpiresAt: string;
  }>(`/cases/${caseId}/clarifications`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resolveClarification(caseId: string, clarificationId: string, note?: string) {
  return apiRequest<{ id: string; status: "RESOLVED"; caseStatus: string }>(
    `/cases/${caseId}/clarifications/${clarificationId}/resolve`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...(note?.trim() ? { note: note.trim() } : {}) }),
    },
  );
}

export function getPublicClarification(clarificationId: string, token: string) {
  return apiRequest<{
    id: string;
    status: string;
    subject: string;
    dueAt?: string | null;
    caseNumber: string;
    messages: Array<{ sender: string; body: string; createdAt: string }>;
  }>(`/public/clarifications/${clarificationId}`, {
    headers: { "x-portal-token": token },
  });
}

export function respondToClarification(clarificationId: string, token: string, message: string) {
  return apiRequest<{ received: boolean; respondedAt: string }>(
    `/public/clarifications/${clarificationId}/respond`,
    {
      method: "POST",
      headers: { "x-portal-token": token },
      body: JSON.stringify({ message }),
    },
  );
}

export function respondToClarificationAsClient(
  caseId: string,
  clarificationId: string,
  message: string,
) {
  return apiRequest<{ received: boolean; respondedAt: string }>(
    `/cases/${caseId}/clarifications/${clarificationId}/respond`,
    { method: "POST", body: JSON.stringify({ message }) },
  );
}
