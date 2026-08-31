import { apiRequest } from "./client";

export type FailedObjectDeletion = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  objectKey: string | null;
  attempts: number;
  processedAt: string | null;
  createdAt: string;
  recoverable: boolean;
};

export function listFailedObjectDeletions(page = 1, pageSize = 5) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return apiRequest<{
    items: FailedObjectDeletion[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/outbox/object-deletions/failed?${query.toString()}`);
}

export function requeueObjectDeletion(eventId: string) {
  return apiRequest<{ id: string; status: "RETRY" }>(
    `/outbox/object-deletions/${encodeURIComponent(eventId)}/requeue`,
    { method: "POST" },
  );
}
