import { apiRequest } from "./client";

export interface CaseActivityEvent {
  id: string;
  action: string;
  resourceType: string;
  actorName: string;
  createdAt: string;
}

export function listCaseActivity(
  caseId: string,
  input: { cursor?: string; resource?: string } = {},
) {
  const query = new URLSearchParams({ limit: "15" });
  if (input.cursor) query.set("cursor", input.cursor);
  if (input.resource) query.set("resource", input.resource);
  return apiRequest<{ items: CaseActivityEvent[]; nextCursor: string | null }>(
    `/cases/${caseId}/activity?${query.toString()}`,
  );
}
