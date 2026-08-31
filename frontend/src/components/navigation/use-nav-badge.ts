import { useQuery } from "@tanstack/react-query";
import type { NavItem } from "@/config/navigation";
import { crmApi } from "@/lib/data-source/crm";
import { operationsApi } from "@/lib/data-source/operations";
import { getExceptionsDashboard } from "@/lib/backend-api/dashboards";

export function useNavBadge(item: NavItem): number | undefined {
  const needsExceptionTotal =
    item.badge?.key === "criticalExceptions" ||
    item.badge?.key === "opsExceptions" ||
    item.badge?.key === "clientActions";
  const operations = useQuery({
    queryKey: ["operations", "navigation-badges"],
    queryFn: () => operationsApi.getDashboard(),
    enabled: Boolean(item.badge) && item.workspace !== "sales-crm" && !needsExceptionTotal,
    staleTime: 30_000,
  });
  const crm = useQuery({
    queryKey: ["crm", "navigation-badges"],
    queryFn: () => crmApi.getOverview(),
    enabled: Boolean(item.badge) && item.workspace === "sales-crm",
    staleTime: 30_000,
  });
  const exceptions = useQuery({
    queryKey:
      item.badge?.key === "clientActions"
        ? ["dashboard", "client", "actions"]
        : ["dashboard", "navigation-badges", "exceptions"],
    queryFn: getExceptionsDashboard,
    enabled: Boolean(item.badge) && needsExceptionTotal,
    staleTime: 30_000,
  });

  if (!item.badge) return undefined;
  if (item.badge.key === "criticalExceptions") return exceptions.data?.summary.critical;
  if (item.badge.key === "opsExceptions") return exceptions.data?.summary.total;
  if (item.badge.key === "clientActions") return exceptions.data?.summary.clientActions;
  return item.workspace === "sales-crm"
    ? crm.data
      ? crmBadge(item.badge.key, crm.data)
      : undefined
    : operations.data
      ? operationsBadge(item.badge.key, operations.data)
      : undefined;
}

function operationsBadge(
  key: string,
  dashboard: Awaited<ReturnType<typeof operationsApi.getDashboard>>,
) {
  const metrics = new Map(dashboard.metrics.map((metric) => [metric.id, metric.value]));
  const stages = new Map(dashboard.stages.map((stage) => [stage.stage, stage.count]));
  const values: Record<string, number> = {
    activeCases: metrics.get("active") ?? 0,
    qaQueue: stages.get("qa") ?? 0,
    criticalExceptions: dashboard.actions.filter((action) => action.treatment === "critical")
      .length,
    opsActiveCases: metrics.get("active") ?? 0,
    opsUnassigned: metrics.get("unassigned") ?? 0,
    opsSlaRisk: metrics.get("slaRisk") ?? 0,
    opsExceptions: dashboard.actions.length,
    opsClarifications: metrics.get("clarifications") ?? 0,
  };
  return values[key];
}

function crmBadge(key: string, dashboard: Awaited<ReturnType<typeof crmApi.getOverview>>) {
  const values: Record<string, number> = {
    crmOpenOpportunities: dashboard.stages
      .filter((stage) => !["WON", "LOST"].includes(stage.stage))
      .reduce((sum, stage) => sum + stage.count, 0),
    crmOverdueFollowUps:
      dashboard.metrics.find((metric) => metric.id === "overdueFollowUps")?.value ?? 0,
  };
  return values[key];
}
