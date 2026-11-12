import { apiRequest } from "./client";
import type { ClarificationUserSummary, SubmittedClarificationDocument } from "./clarifications-l2";

export * from "./clarifications-l2";

export interface Clarification {
  id: string;
  status: string;
  subject: string;
  /** L1 = raised at Data Entry; L2 = raised during verification. Null for older requests. */
  level?: "L1" | "L2" | null;
  checkId?: string | null;
  checkType?: string | null;
  checkStatus?: string | null;
  requestedDocumentType?: string | null;
  submittedDocumentVersion?: number | null;
  submittedDocument?: SubmittedClarificationDocument | null;
  raisedBy?: ClarificationUserSummary | null;
  opsReviewedBy?: ClarificationUserSummary | null;
  opsReviewedAt?: string | null;
  opsReviewNote?: string | null;
  dataEntryReviewedBy?: ClarificationUserSummary | null;
  dataEntryReviewedAt?: string | null;
  dataEntryReviewNote?: string | null;
  reentryCompletedBy?: ClarificationUserSummary | null;
  reentryCompletedAt?: string | null;
  rejectionCount?: number;
  lastRejectedAt?: string | null;
  lastRejectedReason?: string | null;
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
  input: {
    checkId?: string;
    subject: string;
    message: string;
    dueAt?: string;
    requestedDocumentType?: string;
  },
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

/** The case's RM raises insufficiency (its own route; the RM holds no clarification:write). */
export function raiseInsufficiencyAsRm(
  caseId: string,
  input: { checkId?: string; subject: string; message: string },
) {
  return apiRequest<{ id: string; status: string; subject: string }>(
    `/cases/${caseId}/insufficiency`,
    { method: "POST", body: JSON.stringify(input) },
  );
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
