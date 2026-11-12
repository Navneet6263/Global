import { apiRequest } from "./client";
import type { CaseQueue, QueueCase } from "./workflow";

export type DataEntryQueueFilter = "all" | "to_review" | "correction" | "l2_reentry";

export interface L2ReentrySummary {
  id: string;
  subject: string;
  checkId: string | null;
  checkType: string | null;
  requestedDocumentType: string | null;
  submittedDocumentVersion: number | null;
  opsReviewedAt: string | null;
  rejectionCount: number;
  dueAt: string | null;
}

export interface UnifiedQueueCase extends QueueCase {
  l2Reentries?: L2ReentrySummary[];
}

export interface DataEntryUnifiedQueueResponse extends Omit<CaseQueue, "items"> {
  items: UnifiedQueueCase[];
}

export function getUnifiedDataEntryQueue(
  input: {
    view?: "mine" | "team";
    filter?: DataEntryQueueFilter;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  signal?: AbortSignal,
) {
  const params = new URLSearchParams();
  if (input.view) params.set("view", input.view);
  if (input.filter && input.filter !== "all") params.set("filter", input.filter);
  if (input.search?.trim()) params.set("search", input.search.trim());
  if (input.page) params.set("page", String(input.page));
  if (input.pageSize) params.set("pageSize", String(input.pageSize));
  const qs = params.toString();
  return apiRequest<DataEntryUnifiedQueueResponse>(
    `/workflow/data-entry/unified-queue${qs ? `?${qs}` : ""}`,
    { signal },
  );
}
