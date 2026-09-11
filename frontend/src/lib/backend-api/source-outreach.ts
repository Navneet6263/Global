import { apiRequest } from "./client";

export interface SourceContactInput {
  version: number;
  channel: string;
  outcome: string;
  notes: string;
  occurredAt: string;
  nextFollowUpAt?: string;
}
export interface SourceContact {
  id: string;
  channel: string;
  outcome: string;
  notes: string;
  occurredAt: string;
  createdAt: string;
  nextFollowUpAt: string | null;
  actorName: string;
}
export function listSourceContacts(checkId: string, methodId: string, page: number) {
  return apiRequest<{
    items: SourceContact[];
    total: number;
    page: number;
    pageSize: number;
    template: { subject: string; body: string; delivery: "COPY_ONLY" };
  }>(`/checks/${checkId}/methods/${methodId}/outreach?page=${page}&pageSize=8`);
}
export function recordSourceContact(checkId: string, methodId: string, input: SourceContactInput) {
  return apiRequest(`/checks/${checkId}/methods/${methodId}/outreach`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
