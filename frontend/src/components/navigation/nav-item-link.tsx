import { Link, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { NavItem } from "@/config/navigation";
import { BADGE_TONE_MAP } from "@/features/shell/nav-badge-tones";
import { TONE_BADGE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";
import { useNavBadge } from "./use-nav-badge";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { NavigationHint } from "@/features/help/navigation-hint";

interface NavItemLinkProps {
  item: NavItem;
  onNavigate?: () => void;
}

export function NavItemLink({ item, onNavigate }: NavItemLinkProps) {
  const Icon = item.icon;
  const badgeCount = useNavBadge(item);
  const pending = useRouterState({
    select: (state) => state.isLoading && state.location.pathname === item.route,
  });
  const DisplayIcon = pending ? Loader2 : Icon;

  const content = (
    <>
      <DisplayIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-sidebar-accent-foreground group-data-[status=active]:text-primary",
          pending && "motion-safe:animate-spin",
        )}
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
      ) : null}
    </>
  );

  return (
    <NavigationHint title={item.label} description={item.description}>
      <Link
        to={item.route as "/admin"}
        onClick={onNavigate}
        aria-busy={pending || undefined}
        activeOptions={{ exact: item.route === WORKSPACE_PRESENTATION[item.workspace].home }}
        className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
      >
        {content}
      </Link>
    </NavigationHint>
  );
}
