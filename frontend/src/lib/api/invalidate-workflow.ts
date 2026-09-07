import type { QueryClient } from "@tanstack/react-query";

const workflowRoots = new Set([
  "case",
  "cases",
  "dashboard",
  "dashboards",
  "operations",
  "control-tower",
  "analytics",
  "verifier",
  "tasks",
  "qa",
  "qa-queue",
  "reports",
  "field-visits",
  "notifications",
  "navigation-counts",
  "client-portal",
]);

/** Mark related inactive views stale, refetch only the related views on screen. */
export function invalidateWorkflow(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (query) => workflowRoots.has(String(query.queryKey[0])),
    refetchType: "active",
  });
}
