import { Link, useLocation } from "@tanstack/react-router";
import { navFor, type NavItem, type NavWorkspace } from "@/config/navigation";
import { WORKSPACE_PRESENTATION } from "@/config/workspace-presentation";
import { useNavBadge } from "@/components/navigation/use-nav-badge";
import { NavigationHint } from "@/features/help/navigation-hint";
import { sessionForNav } from "@/lib/auth/session";
import { isVisible } from "@/lib/permissions";

const matchesSearch = (item: NavItem, search: Record<string, unknown>) =>
  Object.entries(item.search ?? {}).every(([key, value]) => search[key] === value);

function NavLink({
  item,
  shadowed,
  sharedSearch,
  onNavigate,
}: {
  item: NavItem;
  /** A more specific item (same route, with a filter) is the current page. */
  shadowed: boolean;
  sharedSearch?: Record<string, string>;
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
  const linkSearch =
    sharedSearch || item.search ? { ...(sharedSearch ?? {}), ...(item.search ?? {}) } : undefined;
  return (
    <NavigationHint title={item.label} description={item.description}>
      <Link
        to={item.route as "/admin"}
        search={linkSearch as never}
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
  extraItems = [],
  hiddenRoutes = [],
  sharedSearch,
  onNavigate,
}: {
  workspace: NavWorkspace;
  /** Kept for callers; the workspace name now shows in the header. */
  subtitle?: string;
  extraItems?: readonly NavItem[];
  hiddenRoutes?: readonly string[];
  sharedSearch?: Record<string, string>;
  onNavigate?: () => void;
}) {
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
                  sharedSearch={sharedSearch}
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
