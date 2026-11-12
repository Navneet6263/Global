import { API_BASE_URL as apiBase } from "@/config/api";
import { ApiError, apiRequest, type ProblemDetails } from "./client";
import { fileSha256 } from "./file-digest";
import { beginRequestActivity } from "./request-activity";
import type {
  CandidateL2SubmitResponse,
  ClarificationUserSummary,
  OpsL2QueueResponse,
  ReentryClarificationItem,
} from "./clarifications-l2-types";

export * from "./clarifications-l2-types";

export function getOpsL2Clarifications(input?: {
  status?: string;
  search?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (input?.status) params.set("status", input.status);
  if (input?.search?.trim()) params.set("search", input.search.trim());
  if (input?.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return apiRequest<OpsL2QueueResponse>(`/clarifications/l2/ops-queue${query ? `?${query}` : ""}`);
}

export function completeOpsClarification(
  clarificationId: string,
  input: { dataEntryUserId?: string; note?: string },
) {
  return apiRequest<{
    id: string;
    status: "DATA_ENTRY_PENDING";
    opsReviewedAt: string;
    dataEntryUser: ClarificationUserSummary;
  }>(`/clarifications/${clarificationId}/ops-complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getReentryClarifications(input?: { search?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (input?.search?.trim()) params.set("search", input.search.trim());
  if (input?.limit) params.set("limit", String(input.limit));
  const query = params.toString();
  return apiRequest<{ items: ReentryClarificationItem[] }>(
    `/workflow/clarifications/reentry${query ? `?${query}` : ""}`,
  );
}

export function getReentryClarificationDetail(clarificationId: string) {
  return apiRequest<ReentryClarificationItem>(`/workflow/clarifications/${clarificationId}`);
}

export function rejectL2Document(
  clarificationId: string,
  input: { reason: string; documentVersion?: number },
) {
  return apiRequest<{
    id: string;
    status: "OPEN";
    rejectedVersion: number;
    rejectionCount: number;
    lastRejectedAt: string;
    lastRejectedReason: string;
    preservedVerifiedBaseline: boolean;
  }>(`/workflow/clarifications/${clarificationId}/reject-document`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function completeL2Reentry(
  clarificationId: string,
  input: {
    documentVersion?: number;
    note?: string;
    entries?: Array<Record<string, string>>;
  },
) {
  return apiRequest<{
    id: string;
    status: "RESOLVED";
    caseStatus: string;
    promotedDocumentVersion: number;
    reopenedDependentCount: number;
    reentryCompletedAt: string;
  }>(`/workflow/clarifications/${clarificationId}/complete-reentry`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function submitCandidateL2Clarification(input: {
  accessId: string;
  token: string;
  clarificationId: string;
  file: File;
  message: string;
  documentType?: string;
  expiry?: string;
  noticeVersion?: string;
  onProgress?: (percent: number) => void;
}): Promise<CandidateL2SubmitResponse> {
  const body = new FormData();
  body.append("message", input.message.trim());
  if (input.documentType) body.append("documentType", input.documentType);
  if (input.expiry) body.append("expiry", input.expiry);
  if (input.noticeVersion) body.append("noticeVersion", input.noticeVersion);
  body.append("file", input.file, input.file.name);

  let digest: string | undefined;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) digest = await fileSha256(input.file);
  } catch {
    digest = undefined;
  }

  const finish = beginRequestActivity("upload");
  try {
    return await new Promise<CandidateL2SubmitResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        `${apiBase}/public/candidate-access/${input.accessId}/clarifications/${input.clarificationId}/submit`,
      );
      xhr.withCredentials = true;
      xhr.timeout = 120_000;
      xhr.setRequestHeader("accept", "application/json");
      xhr.setRequestHeader("x-portal-token", input.token);
      xhr.setRequestHeader("idempotency-key", crypto.randomUUID());
      if (digest) xhr.setRequestHeader("x-content-sha256", digest);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !input.onProgress) return;
        const pct = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
        input.onProgress(pct);
      };
      xhr.onerror = () => reject(new ApiError({ status: 0, title: "Network error during upload" }));
      xhr.ontimeout = () =>
        reject(new ApiError({ status: 408, title: "Upload timed out. Please retry." }));
      xhr.onload = () => {
        let parsed: unknown = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          parsed = null;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          input.onProgress?.(100);
          resolve(parsed as CandidateL2SubmitResponse);
          return;
        }
        const problem: ProblemDetails =
          parsed && typeof parsed === "object"
            ? (parsed as ProblemDetails)
            : { status: xhr.status, title: xhr.statusText || "Submission failed" };
        reject(new ApiError(problem));
      };
      xhr.send(body);
    });
  } finally {
    finish();
  }
}
