import { useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleAlert,
  Clock3,
  FolderOpen,
  LayoutDashboard,
  MapPin,
  Package,
  Rocket,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { FIELD_WORK_ENABLED } from "@/config/features";
import { getSession } from "@/lib/api/auth";
import { navigationCountsQuery, type NavigationCounts } from "./ops-workspace-api";

type OpsRoute =
  | "/operations"
  | "/operations/attention"
  | "/operations/cases"
  | "/operations/clarifications"
  | "/operations/team"
  | "/operations/assignments"
  | "/operations/sla"
  | "/operations/exceptions"
  | "/operations/field"
  | "/operations/reports"
  | "/operations/departments"
  | "/operations/clients"
  | "/operations/onboarding"
  | "/operations/packages"
  | "/operations/utv"
  | "/operations/annexure"
  | "/operations/vendor-work";

function Badge({ value, tone = "info" }: { value?: number; tone?: "info" | "warning" }) {
  if (value === undefined || value <= 0) return null;
  return (
    <span className={`ops-nav-badge is-${tone}`} aria-label={`${value} items`}>
      {value > 999 ? "999+" : value}
    </span>
  );
}

function NavGroup({
  label,
  icon: Icon,
  open,
  current,
  badge,
  onToggle,
  children,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  current?: boolean;
  badge?: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="client-nav-group">
      <button
        type="button"
        className={`client-nav-row ${current ? "is-current-group" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span className="client-nav-icon">
          <Icon aria-hidden />
        </span>
        <span>{label}</span>
        {open ? null : badge}
        <ChevronDown className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      <div id={id} className="client-subnav" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

const groupOf: Record<string, string> = {
  "/operations/cases": "cases",
  "/operations/clarifications": "cases",
  "/operations/team": "workload",
  "/operations/assignments": "workload",
  "/operations/departments": "workload",
  "/operations/clients": "workload",
  "/operations/sla": "sla",
  "/operations/exceptions": "sla",
  "/operations/utv": "sla",
  "/operations/annexure": "workload",
  "/operations/vendor-work": "workload",
};

export function OperationsNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const counts = useQuery(navigationCountsQuery);
  const c: NavigationCounts = counts.data?.counts ?? {};
  const { pathname, search } = useLocation({
    select: (location) => ({
      pathname: location.pathname.replace(/\/$/, "") || "/",
      search: location.search as Record<string, unknown>,
    }),
  });
  const view = typeof search["view"] === "string" ? search["view"] : undefined;
  const routeKey = `${pathname}:${view ?? ""}`;
  const routeGroup = pathname === "/operations" && view ? "cases" : (groupOf[pathname] ?? null);
  const [choice, setChoice] = useState<{ route: string; expanded: string | null }>({
    route: routeKey,
    expanded: routeGroup ?? "cases",
  });
  const expanded = choice.route === routeKey ? choice.expanded : (routeGroup ?? choice.expanded);
  const toggle = (group: string) =>
    setChoice({ route: routeKey, expanded: expanded === group ? null : group });
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));

  const link = (
    label: string,
    to: OpsRoute,
    options: {
      icon?: LucideIcon;
      view?: string;
      badge?: ReactNode;
    } = {},
  ) => {
    const active = pathname === to && (to !== "/operations" || view === options.view);
    const Icon = options.icon;
    return (
      <Link
        to={to}
        search={options.view ? { view: options.view } : {}}
        onClick={onNavigate}
        className={`${Icon ? "client-nav-row" : ""} ${active ? "is-active" : ""}`}
        aria-current={active ? "page" : undefined}
      >
        {Icon ? (
          <span className="client-nav-icon">
            <Icon aria-hidden />
          </span>
        ) : null}
        <span>{label}</span>
        {options.badge}
      </Link>
    );
  };

  return (
    <div className="client-nav-content">
      <Link
        to="/operations"
        className="client-brand"
        onClick={onNavigate}
        aria-label="Sapling Global operations"
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
          <span>Operations</span>
        </div>
      </div>
      <nav className="client-nav" aria-label="operations navigation">
        <p className="client-nav-label">Workspace</p>
        {can("dashboard:read") && link("Overview", "/operations", { icon: LayoutDashboard })}
        {can("case:read") &&
          link("Needs attention", "/operations/attention", {
            icon: CircleAlert,
            badge: <Badge value={c.opsExceptions} tone="warning" />,
          })}
        {can("client:read") &&
          link("New sign-ups", "/operations/onboarding", {
            icon: Rocket,
            badge: <Badge value={c.opsSignups} tone="warning" />,
          })}
        {can("case:read") && link("Packages & pricing", "/operations/packages", { icon: Package })}
        {can("case:read") && (
          <NavGroup
            label="Cases"
            icon={FolderOpen}
            open={expanded === "cases"}
            current={routeGroup === "cases"}
            badge={<Badge value={c.opsActiveCases} />}
            onToggle={() => toggle("cases")}
          >
            {link("All cases", "/operations/cases", {
              badge: <Badge value={c.opsActiveCases} />,
            })}
            {link("Awaiting RM", "/operations", {
              view: "needs-rm",
              badge: <Badge value={c.opsUnassigned} />,
            })}
            {link("Awaiting documents", "/operations", { view: "documents" })}
            {can("clarification:read") &&
              link("Corrections & queries", "/operations/clarifications", {
                badge: <Badge value={c.opsClarifications} tone="warning" />,
              })}
            {link("Completed cases", "/operations", { view: "completed" })}
          </NavGroup>
        )}
        {(can("user:read") || can("task:write")) && (
          <NavGroup
            label="RM & workload"
            icon={UsersRound}
            open={expanded === "workload"}
            current={routeGroup === "workload"}
            onToggle={() => toggle("workload")}
          >
            {can("client:read") &&
              link("Companies & RMs", "/operations/clients", {
                badge: <Badge value={c.opsClientsWithoutRm} tone="warning" />,
              })}
            {can("user:read") && link("Departments & teams", "/operations/departments")}
            {can("user:read") && link("Team & user IDs", "/operations/team")}
            {can("task:write") && link("Override allocation", "/operations/assignments")}
            {can("case:read") && link("Team annexure", "/operations/annexure")}
            {can("case:read") && link("Vendor work", "/operations/vendor-work")}
          </NavGroup>
        )}
        {can("dashboard:read") && (
          <NavGroup
            label="SLA & escalations"
            icon={Clock3}
            open={expanded === "sla"}
            current={routeGroup === "sla"}
            badge={<Badge value={c.opsSlaRisk} tone="warning" />}
            onToggle={() => toggle("sla")}
          >
            {link("SLA monitor", "/operations/sla", {
              badge: <Badge value={c.opsSlaRisk} tone="warning" />,
            })}
            {can("case:transition") && link("Exceptions", "/operations/exceptions")}
            {can("case:read") && link("UTV bucket", "/operations/utv")}
          </NavGroup>
        )}
        {can("case:read") &&
          link("Reports & MIS", "/operations/reports", { icon: ChartNoAxesCombined })}
        {/* Field work is on hold; the page and its data stay available behind the flag. */}
        {FIELD_WORK_ENABLED &&
          can("field-visit:read") &&
          link("Field operations", "/operations/field", { icon: MapPin })}
      </nav>
    </div>
  );
}
