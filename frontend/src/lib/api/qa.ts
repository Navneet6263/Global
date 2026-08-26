import { apiRequest } from "./client";

export interface QaQueueItem {
  id: string;
  caseNumber: string;
  priority: string;
  dueAt?: string | null;
  version: number;
  createdAt: string;
  qaClaimedAt?: string | null;
  qaReviewer?: { publicId: string; displayName: string } | null;
  subject: { publicId: string; fullName: string };
  client: { publicId: string; displayName: string };
  checks: Array<{
    publicId: string;
    type: string;
    result?: string | null;
    riskLevel?: string | null;
    status: string;
    sourceSummary?: string | null;
    updatedAt: string;
    findings: Array<{
      publicId: string;
      kind: string;
      severity: string;
      title: string;
      description: string;
      source?: string | null;
    }>;
    tasks: Array<{
      completedAt?: string | null;
      completedBy?: { publicId: string; displayName: string } | null;
    }>;
  }>;
  documents: Array<{
    publicId: string;
    type: string;
    status: string;
    currentVersion: number;
    versions: Array<{
      originalName: string;
      contentType: string;
      sha256: string;
      malwareState: string;
      createdAt: string;
    }>;
  }>;
  fieldVisits: Array<{
    publicId: string;
    status: string;
    address: string;
    distanceMeters?: string | number | null;
    capturedAt?: string | null;
    evidence: Array<{
      publicId: string;
      type: string;
      sha256: string;
      capturedAt: string;
    }>;
  }>;
}

export function getQaQueue(input: { search?: string; cursor?: string; limit?: number } = {}) {
  const query = new URLSearchParams();
  if (input.search) query.set("search", input.search);
  if (input.cursor) query.set("cursor", input.cursor);
  query.set("limit", String(input.limit ?? 25));
  return apiRequest<{
    items: QaQueueItem[];
    nextCursor: string | null;
    summary: { awaiting: number; overdue: number; highRisk: number; claimed: number };
  }>(`/qa/queue?${query.toString()}`);
}

export function claimQaCase(caseId: string, caseVersion: number) {
  return apiRequest<{ id: string; claimedBy: string; caseVersion: number }>(
    `/qa/cases/${caseId}/claim`,
    { method: "POST", body: JSON.stringify({ caseVersion }) },
  );
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
