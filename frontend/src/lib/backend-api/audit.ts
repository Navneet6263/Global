import { apiRequest } from "./client";

export interface AuditEvent {
  id: string;
  action: string;
  resourceType: string;
  resourcePublicId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  createdAt: string;
  actor?: { publicId: string; displayName: string; email: string } | null;
}

export function listAuditEvents(cursor?: string) {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return apiRequest<{ items: AuditEvent[]; nextCursor: string | null }>(
    `/audit-events?${query.toString()}`,
  );
}
