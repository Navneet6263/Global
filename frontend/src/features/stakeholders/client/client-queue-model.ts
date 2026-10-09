export const clientStages = [
  { value: "DRAFT", label: "Draft", tone: "neutral" },
  { value: "CONSENT_PENDING", label: "Consent", tone: "info" },
  { value: "DOCUMENT_PENDING", label: "Documents", tone: "warning" },
  { value: "IN_PROGRESS", label: "Verification", tone: "info" },
  { value: "CLARIFICATION_PENDING", label: "Clarifications", tone: "warning" },
  { value: "QA_REVIEW", label: "Quality review", tone: "review" },
  { value: "MANAGER_REVIEW", label: "Manager review", tone: "review" },
  { value: "REPORT_PENDING", label: "Report preparation", tone: "info" },
  { value: "PAYMENT_PENDING", label: "Payment & release", tone: "warning" },
  { value: "COMPLETED", label: "Completed", tone: "success" },
  { value: "CLOSED", label: "Closed", tone: "neutral" },
  { value: "CANCELLED", label: "Cancelled", tone: "critical" },
  { value: "STOPPED", label: "Stopped", tone: "neutral" },
] as const;

export interface ClientQueueSearch {
  caseId?: string;
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export const CLIENT_PAGE_SIZE = 6;

export function parseClientQueueSearch(input: Record<string, unknown>): ClientQueueSearch {
  const page =
    typeof input["page"] === "string" || typeof input["page"] === "number"
      ? Number(input["page"])
      : 1;
  const q = typeof input["q"] === "string" ? input["q"].trim().slice(0, 120) : "";
  return {
    caseId:
      typeof input["caseId"] === "string" && input["caseId"].length <= 64
        ? input["caseId"] || undefined
        : undefined,
    q: q || undefined,
    status: clientStages.some((stage) => stage.value === input["status"])
      ? (input["status"] as string)
      : undefined,
    page: Number.isSafeInteger(page) && page > 1 && page <= 100_000 ? page : undefined,
    pageSize: input["pageSize"] === 12 || input["pageSize"] === "12" ? 12 : undefined,
  };
}

export function clientQueueQuery(search: ClientQueueSearch) {
  return {
    search: search.q,
    status: search.status,
    page: search.page ?? 1,
    pageSize: search.pageSize ?? CLIENT_PAGE_SIZE,
    limit: search.pageSize ?? CLIENT_PAGE_SIZE,
    sortBy: "updatedAt" as const,
    sortDir: "desc" as const,
  };
}

export function queueRange(
  page: number,
  length: number,
  total: number,
  pageSize = CLIENT_PAGE_SIZE,
) {
  if (!length) return `0 of ${total} cases`;
  const start = (page - 1) * pageSize + 1;
  return `${start}–${Math.min(total, start + length - 1)} of ${total} cases`;
}
