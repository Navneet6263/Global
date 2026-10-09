import { apiRequest } from "./client";

/** Route A: submissions the company admin reviews before Sapling starts. */
export interface ClientReviewItem {
  id: string;
  caseNumber: string;
  version: number;
  candidateName: string;
  state: "TO_REVIEW" | "WITH_CANDIDATE";
  since: string;
  documents: Array<{ id: string; type: string; status: string; currentVersion: number }>;
}

export const listClientReviews = () => apiRequest<{ items: ClientReviewItem[] }>("/client-review");

export const approveClientReview = (caseId: string, version: number) =>
  apiRequest<{ approved: true; autoAssigned: boolean }>(`/client-review/${caseId}/approve`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });

export const returnClientReview = (caseId: string, version: number, reason: string) =>
  apiRequest<{ returned: true; candidateNotified: boolean }>(`/client-review/${caseId}/return`, {
    method: "POST",
    body: JSON.stringify({ version, reason }),
  });
