import { apiRequest } from "./client";

export interface SourceEmailItem {
  id: string;
  to: string;
  cc: string[];
  subject: string;
  attachments: string[];
  maxFollowUps: number;
  followUpsSent: number;
  lastSentAt: string;
  nextFollowUpAt: string | null;
  stoppedAt: string | null;
  stopReason: string | null;
  createdAt: string;
}

export interface SourceEmailCompose {
  checkType: string;
  /** Automatic follow-ups for this check type (Employment 7, Education 3). */
  followUps: number;
  draft: { subject: string; body: string };
  documents: Array<{ id: string; type: string; name: string; version: number; sizeBytes: number }>;
  items: SourceEmailItem[];
}

export interface SourceEmailInput {
  to: string;
  cc: string[];
  subject: string;
  body: string;
  documentIds: string[];
  autoFollowUp: boolean;
}

export const getSourceEmails = (checkId: string) =>
  apiRequest<SourceEmailCompose>(`/checks/${checkId}/source-emails`);

export const sendSourceEmail = (checkId: string, input: SourceEmailInput) =>
  apiRequest<{ id: string; maxFollowUps: number; nextFollowUpAt: string | null }>(
    `/checks/${checkId}/source-emails`,
    { method: "POST", body: JSON.stringify(input) },
  );

export const stopSourceEmail = (checkId: string, emailId: string, reason: string) =>
  apiRequest<{ id: string; stopped: true }>(`/checks/${checkId}/source-emails/${emailId}/stop`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
