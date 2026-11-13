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
          "size-[18px] shrink-0 text-slate-500 transition-colors group-hover:text-slate-900 group-data-[status=active]:text-blue-700",
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
        className="group flex min-h-[38px] items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 data-[status=active]:bg-blue-50 data-[status=active]:font-semibold data-[status=active]:text-blue-700"
      >
        {content}
      </Link>
    </NavigationHint>
  );
}
