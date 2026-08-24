import { apiRequest } from "./client";

export interface QaQueueItem {
  id: string;
  caseNumber: string;
  priority: string;
  dueAt?: string | null;
  version: number;
  subject: { publicId: string; fullName: string };
  client: { publicId: string; displayName: string };
  checks: Array<{
    publicId: string;
    type: string;
    result?: string | null;
    riskLevel?: string | null;
    status: string;
  }>;
}

export function getQaQueue() {
  return apiRequest<{ items: QaQueueItem[] }>("/qa/queue");
}

export function submitQaDecision(
  caseId: string,
  input: {
    decision: "APPROVED" | "REWORK";
    caseVersion: number;
    checklist: string[];
    notes?: string;
    reworkCheckIds: string[];
  },
) {
  return apiRequest<{
    id: string;
    decision: string;
    caseStatus: string;
    caseVersion: number;
  }>(`/qa/cases/${caseId}/decision`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
