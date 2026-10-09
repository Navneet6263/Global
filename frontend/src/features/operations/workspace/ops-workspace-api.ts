import { apiRequest } from "@/lib/backend-api/client";

export interface NavigationCounts {
  activeCases?: number;
  opsActiveCases?: number;
  opsUnassigned?: number;
  opsSlaRisk?: number;
  opsClarifications?: number;
  opsExceptions?: number;
  qaQueue?: number;
  opsStopped?: number;
  opsReopened?: number;
  opsClientsWithoutRm?: number;
  /** Self sign-up companies waiting in onboarding. */
  opsSignups?: number;
  /** Live cases escalated by Platform Admin or Operations. */
  opsEscalated?: number;
}

export const navigationCountsQuery = {
  // Shares the cache entry used by the sidebar badge hook.
  queryKey: ["navigation-counts", "operations"],
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    apiRequest<{ counts: NavigationCounts }>("/dashboards/navigation", { signal }),
  staleTime: 30_000,
};

/** Assign or change the responsible RM. The API audits the change and notifies the RM. */
export function assignCaseOwner(
  caseId: string,
  input: { ownerId: string; version: number; note?: string },
) {
  return apiRequest<{
    id: string;
    owner: { id: string; displayName: string };
    version: number;
  }>(`/cases/${caseId}/owner`, { method: "PATCH", body: JSON.stringify(input) });
}

/** Marks the case urgent and notifies the client admins; recorded in the audit trail. */
export function escalateCase(caseId: string, input: { version: number; note?: string }) {
  return apiRequest<{ id: string; priority: string; version: number }>(
    `/cases/${caseId}/escalation`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
