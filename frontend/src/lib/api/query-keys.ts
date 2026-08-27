import type { CaseQuery } from "@/lib/contracts/case";
import type { ClientQuery } from "@/lib/contracts/client";
import type { UserQuery } from "@/lib/contracts/user";
import type { AuditQuery } from "@/lib/contracts/audit";
import type { AnalyticsQuery } from "@/lib/contracts/analytics";

export const queryKeys = {
  controlTower: () => ["control-tower"] as const,
  platformHealth: () => ["platform-health"] as const,
  cases: (query: CaseQuery) => ["cases", query] as const,
  caseById: (id: string) => ["cases", "detail", id] as const,
  caseFacets: () => ["cases", "facets"] as const,
  clients: (query: ClientQuery) => ["clients", query] as const,
  users: (query: UserQuery) => ["users", query] as const,
  audit: (query: AuditQuery) => ["audit", query] as const,
  auditFacets: () => ["audit", "facets"] as const,
  security: () => ["security", "overview"] as const,
  analytics: (query: AnalyticsQuery) => ["analytics", "executive", query] as const,
  settings: () => ["settings"] as const,
  notifications: () => ["notifications"] as const,
};
