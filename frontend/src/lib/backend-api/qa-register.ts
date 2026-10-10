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

/** QA dashboard: live queue health and the reviewer's own decision trends. */
export interface QaDashboard {
  generatedAt: string;
  queue: {
    awaiting: number;
    available: number;
    mine: number;
    reservedByOthers: number;
    highRisk: number;
    sla: { overdue: number; dueToday: number; later: number; noDueDate: number };
    waiting: { under4h: number; under24h: number; under3d: number; over3d: number };
  };
  me: {
    today: number;
    week: number;
    previousWeek: number;
    approved30: number;
    returned30: number;
    approvalRate: number | null;
    medianReviewMinutes: number | null;
  };
  teamToday: number;
  trend: Array<{ date: string; approved: number; returned: number }>;
  upNext: Array<{
    id: string;
    caseNumber: string;
    candidateName: string;
    clientName: string;
    priority: string;
    dueAt: string | null;
    checks: number;
    highRisk: boolean;
    reservedByMe: boolean;
    waitingHours: number;
  }>;
  reworkByType: Array<{ type: string; count: number }>;
  recent: Array<{
    id: string;
    decision: string;
    createdAt: string;
    caseId: string;
    caseNumber: string;
    caseStatus: string;
    candidateName: string;
    clientName: string;
  }>;
}

export function getQaDashboard(signal?: AbortSignal) {
  return apiRequest<QaDashboard>("/qa/dashboard", { signal });
}
