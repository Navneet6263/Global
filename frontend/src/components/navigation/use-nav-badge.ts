import { useQuery } from "@tanstack/react-query";
import type { NavItem } from "@/config/navigation";
import { apiRequest } from "@/lib/backend-api/client";
import { getVerifierInsights } from "@/lib/backend-api/tasks";
import { crmOverviewQueryOptions } from "@/features/crm/hooks/use-crm";

export function useNavBadge(item: NavItem): number | undefined {
  const key = item.badge?.key;
  const needsVerifier = key?.startsWith("verifier") ?? false;
  const needsCrm = item.workspace === "sales-crm";
  const counts = useQuery({
    queryKey: ["navigation-counts", item.workspace],
    queryFn: ({ signal }) =>
      apiRequest<{ counts: Record<string, number> }>("/dashboards/navigation", { signal }),
    enabled: Boolean(key) && !needsCrm && !needsVerifier,
    staleTime: 30_000,
  });
  const crm = useQuery({ ...crmOverviewQueryOptions, enabled: Boolean(key) && needsCrm });
  const verifier = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    enabled: Boolean(key) && needsVerifier,
    staleTime: 30_000,
  });
  if (!key) return undefined;
  if (needsVerifier) {
    if (!verifier.data) return undefined;
    const totals: Record<string, number> = {
      verifierActive: verifier.data.summary.active,
      verifierOverdue: verifier.data.summary.overdue,
      verifierBlocked: verifier.data.summary.blocked,
    };
    return totals[key];
  }
  if (needsCrm) {
    if (!crm.data) return undefined;
    return key === "crmOpenOpportunities"
      ? crm.data.stages
          .filter((stage) => !["WON", "LOST"].includes(stage.stage))
          .reduce((sum, stage) => sum + stage.count, 0)
      : crm.data.metrics.find((metric) => metric.id === "overdueFollowUps")?.value;
  }
  return counts.data?.counts[key];
}
