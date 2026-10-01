import { useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  FileCheck2,
  Files,
  LayoutDashboard,
  ReceiptIndianRupee,
  type LucideIcon,
} from "lucide-react";
import { ClientSupportLauncher } from "@/features/support/components/ClientSupportLauncher";
import { getSession } from "@/lib/api/auth";
import { NavigationHint } from "@/features/help/navigation-hint";
import { navFor } from "@/config/navigation";

function NavGroup({
  label,
  icon: Icon,
  open,
  current,
  onToggle,
  children,
}: {
  label: string;
  icon: LucideIcon;
  open: boolean;
  current?: boolean;
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
        <ChevronDown className={open ? "rotate-180" : ""} aria-hidden />
      </button>
      <div id={id} className="client-subnav" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

export function ClientPortalNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const { pathname, search } = useLocation({
    select: (location) => ({
      pathname: location.pathname.replace(/\/$/, ""),
      search: location.search as Record<string, unknown>,
    }),
  });
  const routeKey = `${pathname}:${search["status"] ?? ""}`;
  const reportSelected =
    pathname === "/client-portal/reports" ||
    (pathname === "/client-portal/verifications" && search["status"] === "PAYMENT_PENDING");
  const routeGroup = reportSelected
    ? "reports"
    : ["/client-portal", "/client-portal/verifications", "/client-portal/actions"].includes(
          pathname,
        )
      ? "verifications"
      : null;
  const [choice, setChoice] = useState<{ route: string; expanded: string | null }>({
    route: routeKey,
    expanded: routeGroup,
  });
  const expanded = choice.route === routeKey ? choice.expanded : routeGroup;
  const toggle = (group: string) =>
    setChoice({ route: routeKey, expanded: expanded === group ? null : group });
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
  const item = (
    label: string,
    to:
      | "/client-portal"
      | "/client-portal/verifications"
      | "/client-portal/actions"
      | "/client-portal/reports"
      | "/client-portal/analytics"
      | "/client-portal/billing",
    status?: string,
    Icon?: LucideIcon,
  ) => {
    const active = pathname === to && search["status"] === status;
    return (
      <NavigationHint
        title={label}
        description={
          navFor("client-admin").items.find((entry) => entry.route === to)?.description ?? label
        }
      >
        <Link
          to={to}
          search={status ? { status } : {}}
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
        </Link>
      </NavigationHint>
    );
  };
  return (
    <div className="client-nav-content">
      <Link
        to="/client-portal"
        className="client-brand"
        onClick={onNavigate}
        aria-label="Sapling Global client portal"
      >
        <img src="/brand/sapling-wordmark.png" width="160" height="37" alt="Sapling Global" />
      </Link>
      <div className="client-organisation">
        <span className="client-organisation-icon">
          <Building2 aria-hidden />
        </span>
        <div>
          <strong title={session.data?.clientName}>
            {session.data?.clientName ?? "Your organisation"}
          </strong>
          <span>Client workspace</span>
        </div>
      </div>
      <nav className="client-nav" aria-label="client-admin navigation">
        <p className="client-nav-label">Workspace</p>
        {can("dashboard:read") && item("Overview", "/client-portal", undefined, LayoutDashboard)}
        {can("case:read") && (
          <NavGroup
            label="Verifications"
            icon={Files}
            open={expanded === "verifications"}
            current={routeGroup === "verifications" && pathname !== "/client-portal"}
            onToggle={() => toggle("verifications")}
          >
            {item("All verifications", "/client-portal/verifications")}
            {item("Needs your action", "/client-portal/actions")}
            {item("In progress", "/client-portal/verifications", "IN_PROGRESS")}
            {item("Completed", "/client-portal/verifications", "COMPLETED")}
          </NavGroup>
        )}
        {can("report:read") && (
          <NavGroup
            label="Reports"
            icon={FileCheck2}
            open={expanded === "reports"}
            current={reportSelected}
            onToggle={() => toggle("reports")}
          >
            {item("Published reports", "/client-portal/reports")}
            {can("case:read") &&
              item("Awaiting release", "/client-portal/verifications", "PAYMENT_PENDING")}
          </NavGroup>
        )}
        {can("dashboard:read") &&
          item("Insights", "/client-portal/analytics", undefined, ChartNoAxesCombined)}
        {can("case:read") &&
          item("Invoices & payments", "/client-portal/billing", undefined, ReceiptIndianRupee)}
        <ClientSupportLauncher
          label="Queries & support"
          className="client-nav-row client-support-nav"
        />
      </nav>
    </div>
  );
}
