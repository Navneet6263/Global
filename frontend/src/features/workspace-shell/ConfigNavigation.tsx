import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { navFor, type NavItem, type NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { useNavBadge } from "@/components/navigation/use-nav-badge";
import { NavigationHint } from "@/features/help/navigation-hint";
import { getSession } from "@/lib/api/auth";
import { sessionForNav } from "@/lib/auth/session";
import { isVisible } from "@/lib/permissions";

const matchesSearch = (item: NavItem, search: Record<string, unknown>) =>
  Object.entries(item.search ?? {}).every(([key, value]) => search[key] === value);

function NavLink({
  item,
  shadowed,
  onNavigate,
}: {
  item: NavItem;
  /** A more specific item (same route, with a filter) is the current page. */
  shadowed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const badge = useNavBadge(item);
  const pathname = useLocation({ select: (location) => location.pathname.replace(/\/$/, "") });
  const search = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const home = WORKSPACE_PRESENTATION[item.workspace].home;
  const onRoute = item.route === home ? pathname === home : pathname.startsWith(item.route);
  const active = item.search ? onRoute && matchesSearch(item, search) : onRoute && !shadowed;
  return (
    <NavigationHint title={item.label} description={item.description}>
      <Link
        to={item.route as "/admin"}
        search={item.search as never}
        onClick={onNavigate}
        className={`client-nav-row ${item.sub ? "is-sub" : ""} ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <span className="client-nav-icon">
          <Icon aria-hidden />
        </span>
        <span>{item.label}</span>
        {badge !== undefined && badge > 0 ? (
          <span className={`ops-nav-badge is-${item.badge?.tone ?? "info"}`}>
            {badge > 999 ? "999+" : badge}
          </span>
        ) : null}
      </Link>
    </NavigationHint>
  );
}

/**
 * Sidebar for role workspaces in the clean workspace style, driven by the navigation
 * config so permissions and badges stay in one place. `extraItems` adds role-conditional
 * entries (e.g. a Team Leader's team queue) after the configured ones.
 */
export function ConfigNavigation({
  workspace,
  subtitle,
  extraItems = [],
  hiddenRoutes = [],
  onNavigate,
}: {
  workspace: NavWorkspace;
  subtitle: string;
  extraItems?: readonly NavItem[];
  hiddenRoutes?: readonly string[];
  onNavigate?: () => void;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const navSession = sessionForNav(workspace);
  const { groups, items } = navFor(workspace);
  const all = [...extraItems, ...items].filter(
    (item) => isVisible(navSession, item) && !hiddenRoutes.includes(item.route),
  );
  const home = WORKSPACE_PRESENTATION[workspace].home;
  const pathname = useLocation({ select: (location) => location.pathname.replace(/\/$/, "") });
  const search = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const filteredActive = all.some(
    (item) => item.search && pathname.startsWith(item.route) && matchesSearch(item, search),
  );
  return (
    <div className="client-nav-content">
      <Link
        to={home as "/admin"}
        className="client-brand"
        onClick={onNavigate}
        aria-label="Sapling Global"
      >
        <img src="/brand/sapling-wordmark.png" width="160" height="37" alt="Sapling Global" />
      </Link>
      <div className="client-organisation">
        <span className="client-organisation-icon">
          <Building2 aria-hidden />
        </span>
        <div>
          <strong title={session.data?.tenantName}>
            {session.data?.tenantName ?? "Sapling Global"}
          </strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <nav className="client-nav" aria-label={`${workspace} navigation`}>
        {groups.map((group) => {
          const groupItems = all.filter((item) => item.group === group.id);
          if (!groupItems.length) return null;
          return (
            <div key={group.id}>
              <p className="client-nav-label">{group.label}</p>
              {groupItems.map((item) => (
                <NavLink
                  key={`${item.route}:${item.label}`}
                  item={item}
                  shadowed={filteredActive}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
