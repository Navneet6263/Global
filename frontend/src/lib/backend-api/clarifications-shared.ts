import { apiRequest } from "./client";
import type {
  ClarificationPortalMode,
  OpsL2QueueResponse,
  SharedL1QueueResponse,
  SharedL1QueueState,
} from "./clarifications-l2-types";

export interface SharedL2QueueQuery {
  status?: "OPEN" | "CANDIDATE_SUBMITTED" | "DATA_ENTRY_PENDING" | "ALL";
  search?: string;
  limit?: number;
}

export interface SharedL1QueueQuery {
  state?: SharedL1QueueState;
  search?: string;
  limit?: number;
}

/** Shared L2 clarification queue for Operations and Client-mapped SPOC-RM. */
export function getSharedL2Clarifications(
  mode: ClarificationPortalMode,
  query: SharedL2QueueQuery = {},
) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const base =
    mode === "rm" ? "/workflow/clarifications/rm-l2-queue" : "/clarifications/l2/ops-queue";
  return apiRequest<OpsL2QueueResponse>(`${base}${qs ? `?${qs}` : ""}`);
}

/** Hand off an L2 candidate submission to Data Entry from either Operations or RM. */
export function completeSharedL2Clarification(
  mode: ClarificationPortalMode,
  clarificationId: string,
  input: { dataEntryUserId?: string; note?: string },
) {
  const path =
    mode === "rm"
      ? `/workflow/clarifications/${encodeURIComponent(clarificationId)}/rm-handoff`
      : `/clarifications/${encodeURIComponent(clarificationId)}/ops-complete`;
  return apiRequest<{
    clarificationId: string;
    status: "DATA_ENTRY_PENDING";
    dataEntryUserId: string;
    dataEntryUserName: string;
    opsReviewedAt: string;
  }>(path, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Shared L1 candidate & client clarification threads for Operations and Client-mapped SPOC-RM. */
export function getSharedL1Clarifications(
  mode: ClarificationPortalMode,
  query: SharedL1QueueQuery = {},
) {
  const params = new URLSearchParams();
  if (query.state) params.set("state", query.state);
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const base = mode === "rm" ? "/workflow/clarifications/rm-l1-queue" : "/clarifications/l1-queue";
  return apiRequest<SharedL1QueueResponse>(`${base}${qs ? `?${qs}` : ""}`);
}

/** Resolve an L1 clarification thread from either Operations or RM. */
export function resolveSharedClarification(
  mode: ClarificationPortalMode,
  caseId: string,
  clarificationId: string,
  note?: string,
) {
  const path =
    mode === "rm"
      ? `/workflow/cases/${encodeURIComponent(caseId)}/clarifications/${encodeURIComponent(clarificationId)}/rm-resolve`
      : `/cases/${encodeURIComponent(caseId)}/clarifications/${encodeURIComponent(clarificationId)}/resolve`;
  return apiRequest<{ status: string }>(path, {
    method: "PATCH",
    body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
  });
}
