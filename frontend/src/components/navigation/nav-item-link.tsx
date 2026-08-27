import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { NavItem } from "@/config/navigation";
import { BADGE_TONE_MAP } from "@/features/shell/nav-badge-tones";
import { operationsApi } from "@/lib/data-source/operations";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

interface NavItemLinkProps {
  item: NavItem;
  onNavigate?: () => void;
}

export function NavItemLink({ item, onNavigate }: NavItemLinkProps) {
  const Icon = item.icon;
  const dashboard = useQuery({
    queryKey: ["operations", "navigation-badges"],
    queryFn: () => operationsApi.getDashboard(),
    enabled: Boolean(item.badge),
    staleTime: 30_000,
  });
  const badgeCount =
    item.badge && dashboard.data ? badgeValue(item.badge.key, dashboard.data) : undefined;

  const content = (
    <>
      <Icon
        className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground group-data-[status=active]:text-primary"
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {badgeCount !== undefined && item.badge ? (
        <span
          className={cn(
            "num rounded-full border px-1.5 py-px text-[11px] font-medium",
            TONE_BADGE[BADGE_TONE_MAP[item.badge.tone]],
          )}
        >
          {badgeCount}
        </span>
      ) : item.phase === "planned" ? (
        <span className="rounded-md border border-border bg-muted px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          Soon
        </span>
      ) : null}
    </>
  );

  if (item.phase === "planned") {
    return (
      <div
        aria-disabled="true"
        title={`${item.description} · Coming soon`}
        className="group flex cursor-default items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-sidebar-foreground/60"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={item.route as "/admin"}
      onClick={onNavigate}
      title={item.description}
      activeOptions={{ exact: item.route === "/admin" || item.route === "/operations" }}
      className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
    >
      {content}
    </Link>
  );
}

function badgeValue(
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
