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

export function listAuditEvents(filters: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== "all") query.set(key, String(value));
  }
  return apiRequest<{ items: AuditEvent[]; total: number; page: number; pageSize: number }>(
    `/audit-events?${query.toString()}`,
  );
}

export function getAuditFacets() {
  return apiRequest<{ actors: string[]; resourceTypes: string[] }>("/audit-events/facets");
}
