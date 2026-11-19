import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ChartNoAxesCombined,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  KanbanSquare,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  ReceiptIndianRupee,
  Rocket,
  SlidersHorizontal,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { getSession } from "@/lib/api/auth";
import { apiRequest } from "@/lib/backend-api/client";
import { NavigationHint } from "@/features/help/navigation-hint";
import { navFor } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { getClientFinanceOverview } from "@/lib/backend-api/client-finance";

type ClientRoute =
  | "/client-portal"
  | "/client-portal/verifications"
  | "/client-portal/actions"
  | "/client-portal/reports"
  | "/client-portal/analytics"
  | "/client-portal/billing"
  | "/client-portal/support"
  | "/client-portal/onboarding"
  | "/client-portal/review"
  | "/client-portal/pipeline";

interface Item {
  label: string;
  to: ClientRoute;
  icon: LucideIcon;
  status?: string;
  view?: "custom" | "invoices" | "mis";
  /** What the row is for, shown as a tooltip. */
  note?: string;
  badge?: number | string;
  badgeTone?: "warn" | "bad" | "brand";
}

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** Client Admin menu, laid out like the Task app: labelled groups, one row per page. */
export function ClientPortalNavigation({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  /** Desktop sidebar collapsed to icons: labels become tooltips, badges become dots. */
  collapsed?: boolean;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const { pathname, search } = useLocation({
    select: (location) => ({
      pathname: location.pathname.replace(/\/$/, "") || "/client-portal",
      search: location.search as Record<string, unknown>,
    }),
  });
  // Self sign-up companies see only onboarding and support until Operations approves them.
  const onboarding = session.data?.clientStatus === "ONBOARDING";
  // Submissions waiting for this company's review (badge).
  const counts = useQuery({
    queryKey: ["navigation-counts", "client-admin"],
    queryFn: ({ signal }) =>
      apiRequest<{ counts: Record<string, number> }>("/dashboards/navigation", { signal }),
    enabled: Boolean(session.data) && !onboarding,
    staleTime: 30_000,
  });
  const reviews = counts.data?.counts["clientReviews"] ?? 0;
  const actions = counts.data?.counts["clientActions"] ?? 0;
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
  const show = (condition: boolean, item: Item) => (condition ? [item] : []);

  // Amount the company still owes (badge on Invoices & payments).
  const finance = useQuery({
    queryKey: ["client-finance", "overview"],
    queryFn: getClientFinanceOverview,
    enabled: Boolean(session.data) && !onboarding && can("case:read"),
    staleTime: 60_000,
  });
  const due = Number(finance.data?.summary.outstanding ?? 0);
  const overdue = Number(finance.data?.summary.overdueAmount ?? 0);

  const groups: Array<{ label: string; items: Item[] }> = onboarding
    ? [
        {
          label: "Home",
          items: [{ label: "Get started", to: "/client-portal/onboarding", icon: Rocket }],
        },
      ]
    : [
        {
          label: "Home",
          items: [
            ...show(can("dashboard:read"), {
              label: "Overview",
              to: "/client-portal",
              icon: LayoutDashboard,
              note: "Today at a glance and what to do first",
            }),
            ...show(can("case:read"), {
              label: "Your to-do",
              to: "/client-portal/actions",
              icon: ListChecks,
              note: "Documents to replace and questions to answer, most urgent first",
              badge: actions,
              badgeTone: "warn",
            }),
            ...show(can("case:read") && (reviews > 0 || pathname === "/client-portal/review"), {
              label: "Review submissions",
              to: "/client-portal/review",
              icon: ClipboardCheck,
              note: "Approve what your candidates uploaded",
              badge: reviews,
              badgeTone: "brand",
            }),
          ],
        },
        {
          label: "Verifications",
          items: can("case:read")
            ? [
                {
                  label: "All candidates",
                  to: "/client-portal/verifications",
                  icon: UsersRound,
                  note: "Search, filter and download every case",
                },
                {
                  label: "Pipeline",
                  to: "/client-portal/pipeline",
                  icon: KanbanSquare,
                  note: "Every case by stage: see where work is waiting",
                },
              ]
            : [],
        },
        {
          label: "Reports",
          items: [
            ...show(can("report:read"), {
              label: "Final reports",
              to: "/client-portal/reports",
              icon: FileCheck2,
              note: "Released reports to download and verify",
            }),
            ...show(can("case:read"), {
              label: "MIS & Excel",
              to: "/client-portal/reports",
              icon: FileSpreadsheet,
              view: "mis",
              note: "Ready-made MIS, bulk downloads and schedules",
            }),
            ...show(can("case:read"), {
              label: "Custom export",
              to: "/client-portal/reports",
              icon: SlidersHorizontal,
              view: "custom",
              note: "Pick the columns and filters you need",
            }),
            ...show(can("dashboard:read"), {
              label: "Insights",
              to: "/client-portal/analytics",
              icon: ChartNoAxesCombined,
              note: "Trends, outcomes and branch comparison",
            }),
          ],
        },
        {
          label: "Billing",
          items: show(can("case:read"), {
            label: "Payments",
            to: "/client-portal/billing",
            icon: ReceiptIndianRupee,
            note: "What you owe, by when, and every invoice",
            badge: due > 0 ? `${money(due)} due` : undefined,
            badgeTone: overdue > 0 ? "bad" : "warn",
          }),
        },
      ];
  groups.push({
    label: "Help",
    items: show(can("support:request"), {
      label: "Queries & support",
      to: "/client-portal/support",
      icon: LifeBuoy,
      note: "Ask Sapling anything about a case or invoice",
    }),
  });

  const isActive = (item: Item) =>
    pathname === item.to && (item.to !== "/client-portal/reports" || search["view"] === item.view);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        aria-label="client-admin navigation"
        className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-2.5")}
      >
        {groups
          .filter((group) => group.items.length)
          .map((group) => (
            <div key={group.label} className="mb-4">
              {collapsed ? (
                <hr className="mx-2 mb-2 border-line" aria-hidden />
              ) : (
                <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-dim uppercase">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <NavigationHint
                      key={`${item.to}-${item.label}`}
                      title={item.label}
                      description={
                        item.note ??
                        navFor("client-admin").items.find((entry) => entry.route === item.to)
                          ?.description ??
                        item.label
                      }
                    >
                      <Link
                        to={item.to}
                        search={
                          item.view
                            ? { view: item.view }
                            : item.status
                              ? { status: item.status }
                              : {}
                        }
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg py-2 text-[14px] text-ink transition",
                          collapsed ? "justify-center px-0" : "px-3",
                          active ? "bg-brand-soft font-semibold" : "font-medium hover:bg-subtle",
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden />
                        {collapsed ? null : <span className="flex-1 truncate">{item.label}</span>}
                        {item.badge && collapsed ? (
                          <span
                            aria-hidden
                            className={cn(
                              "absolute top-1.5 right-2 size-2 rounded-full ring-2 ring-surface",
                              item.badgeTone === "bad"
                                ? "bg-bad"
                                : item.badgeTone === "brand"
                                  ? "bg-brand"
                                  : "bg-warn",
                            )}
                          />
                        ) : null}
                        {item.badge && !collapsed ? (
                          <span
                            className={cn(
                              "min-w-[18px] rounded-full px-1.5 text-center text-[11px] leading-[18px] font-bold whitespace-nowrap",
                              item.badgeTone === "bad"
                                ? "bg-bad-soft text-bad"
                                : item.badgeTone === "brand"
                                  ? "bg-brand-soft text-brand"
                                  : "bg-warn-soft text-warn",
                            )}
                            aria-label={
                              typeof item.badge === "number" ? `${item.badge} waiting` : item.badge
                            }
                          >
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </NavigationHint>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>
    </div>
  );
}
