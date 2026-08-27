import type { StatusTone } from "./common";

export type AuditCategory =
  "access" | "case" | "client" | "document" | "policy" | "report" | "finance";

export interface AuditEvent {
  id: string;
  requestId: string;
  category: AuditCategory;
  action: string;
  actorName: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  at: string;
  ipAddress: string | null;
  before: Record<string, string | number | boolean | null> | null;
  after: Record<string, string | number | boolean | null> | null;
}

export interface AuditQuery {
  search?: string;
  category?: AuditCategory | "all";
  actor?: string | "all";
  resourceType?: string | "all";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export const AUDIT_CATEGORY_META: Record<AuditCategory, { label: string; tone: StatusTone }> = {
  access: { label: "Access", tone: "info" },
  case: { label: "Case", tone: "neutral" },
  client: { label: "Client", tone: "success" },
  document: { label: "Document", tone: "warning" },
  policy: { label: "Policy", tone: "review" },
  report: { label: "Report", tone: "info" },
  finance: { label: "Finance", tone: "critical" },
};
