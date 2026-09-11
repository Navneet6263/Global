import { apiRequest } from "./client";

export type PrivacyKind = "DATA_REQUEST" | "INCIDENT";
export interface PrivacyRecord {
  id: string;
  kind: PrivacyKind;
  title: string;
  description: string;
  subjectReference: string | null;
  requestType: string | null;
  severity: string | null;
  status: string;
  dueAt: string | null;
  resolutionNote: string | null;
  evidenceReference: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: { publicId: string; displayName: string };
  updatedBy: { publicId: string; displayName: string };
}
export interface PrivacyQuery {
  kind?: PrivacyKind;
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
}
export interface PrivacyPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}
export interface PrivacyCreate {
  kind: PrivacyKind;
  title: string;
  description: string;
  subjectReference?: string;
  requestType?: string;
  severity?: string;
  dueAt?: string;
}
export interface PrivacyEvent {
  id: string;
  action: string;
  createdAt: string;
  actor: { publicId: string; displayName: string } | null;
  before: { status?: string } | null;
  after: {
    status?: string;
    note?: string;
    description?: string;
    evidenceReference?: string;
  } | null;
}
export const privacyNotice =
  "Human review and decision tracking only. No automatic deletion, consent withdrawal or regulatory notification happens here.";
export const privacyStatus = {
  DATA_REQUEST: ["RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED", "FULFILLED"],
  INCIDENT: ["OPEN", "INVESTIGATING", "CONTAINED", "CLOSED"],
};
export const privacyNext: Record<string, string[]> = {
  RECEIVED: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["FULFILLED"],
  OPEN: ["INVESTIGATING"],
  INVESTIGATING: ["CONTAINED"],
  CONTAINED: ["INVESTIGATING", "CLOSED"],
};
export const privacyLabel = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
export function listPrivacyRecords(query: PrivacyQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.kind) params.set("kind", query.kind);
  if (query.status) params.set("status", query.status);
  if (query.search?.trim()) params.set("search", query.search.trim());
  return apiRequest<PrivacyPage<PrivacyRecord>>(`/privacy-records?${params}`);
}
export const getPrivacyRecord = (id: string) => apiRequest<PrivacyRecord>(`/privacy-records/${id}`);
export const getPrivacyEvents = (id: string, page: number) =>
  apiRequest<PrivacyPage<PrivacyEvent>>(`/privacy-records/${id}/events?page=${page}&pageSize=8`);
export const createPrivacyRecord = (input: PrivacyCreate) =>
  apiRequest<{ id: string }>("/privacy-records", { method: "POST", body: JSON.stringify(input) });
export const updatePrivacyRecord = (
  id: string,
  input: { version: number; status: string; note: string; evidenceReference?: string },
) =>
  apiRequest<{ id: string; version: number }>(`/privacy-records/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
