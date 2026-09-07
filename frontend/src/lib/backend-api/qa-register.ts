import { apiRequest } from "./client";
import type { QaQueueItem } from "./qa";

export type QaRegisterView = "all" | "available" | "mine" | "corrections";
export interface QaRegisterItem extends Omit<QaQueueItem, "checks" | "documents" | "fieldVisits"> {
  status: string;
  checkCount: number;
  completedCheckCount: number;
  documentCount: number;
  highestRisk: string | null;
  claimActive: boolean;
  correctionReason: string | null;
}
export interface QaDecisionRecord {
  publicId: string;
  decision: string;
  notes: string | null;
  createdAt: string;
  case: {
    publicId: string;
    caseNumber: string;
    status: string;
    subject: { fullName: string };
    client: { displayName: string };
    reports: Array<{ status: string; currentVersion: number }>;
  };
}
type Query = { search?: string | undefined; page?: number; limit?: number; view?: QaRegisterView };
export interface QaPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export function getQaRegister(input: Query = {}, signal?: AbortSignal) {
  return apiRequest<
    QaPage<QaRegisterItem> & {
      summary: { awaiting: number; overdue: number; highRisk: number; claimed: number };
    }
  >(`/qa/register?${params(input)}`, { signal });
}
export function getQaDetail(caseId: string, signal?: AbortSignal) {
  return apiRequest<QaQueueItem>(`/qa/cases/${caseId}`, { signal });
}
export function getQaHistory(input: Query = {}, signal?: AbortSignal) {
  return apiRequest<QaPage<QaDecisionRecord>>(`/qa/history?${params(input)}`, { signal });
}
function params(input: Query) {
  const query = new URLSearchParams({
    page: String(input.page ?? 1),
    limit: String(input.limit ?? 25),
    view: input.view ?? "all",
  });
  if (input.search?.trim()) query.set("search", input.search.trim());
  return query.toString();
}
