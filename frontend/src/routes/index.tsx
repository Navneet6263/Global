import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  GitBranch,
  Radio,
  SearchX,
  TrendingUp,
} from "lucide-react";
import { useDeferredValue, useState, type ComponentType } from "react";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getSession } from "@/lib/api/auth";
import { listCases, type CaseListItem } from "@/lib/api/cases";
import { getCrmOverview, type CrmOverview } from "@/lib/api/crm";
import {
  getExceptionsDashboard,
  getOperationsDashboard,
  type ExceptionsDashboard,
  type OperationsDashboard,
} from "@/lib/api/dashboards";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Operations Command Center — Sapling Global" }] }),
  component: OperationsDashboard,
});

const statusTone: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-600",
  CONSENT_PENDING: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  QA_PENDING: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function OperationsDashboard() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const dashboard = useQuery({
    queryKey: ["dashboard", "operations"],
    queryFn: getOperationsDashboard,
    refetchInterval: 60_000,
  });
  const exceptions = useQuery({
    queryKey: ["dashboard", "exceptions"],
    queryFn: getExceptionsDashboard,
    refetchInterval: 60_000,
  });
  const canReadCrm =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("crm:read");
  const crm = useQuery({
    queryKey: ["crm", "overview"],
    queryFn: getCrmOverview,
    enabled: Boolean(canReadCrm),
    refetchInterval: 60_000,
    retry: false,
  });
  const cases = useQuery({
    queryKey: ["cases", { search: deferredSearch }],
    queryFn: () =>
      listCases(deferredSearch ? { search: deferredSearch, limit: 25 } : { limit: 25 }),
  });
  const refreshing =
    dashboard.isFetching || exceptions.isFetching || crm.isFetching || cases.isFetching;
  const refresh = () => {
    void dashboard.refetch();
    void exceptions.refetch();
    void cases.refetch();
    if (canReadCrm) void crm.refetch();
  };

  return (
    <div className="min-h-screen bg-white text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={refresh}
          isRefreshing={refreshing}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 pt-4 sm:px-5">
          <CommandHeader generatedAt={dashboard.data?.generatedAt} />
          {dashboard.isLoading ? <DashboardSkeleton /> : null}
          {dashboard.isError ? (
            <ErrorState message={dashboard.error.message} onRetry={refresh} />
          ) : null}
          {dashboard.data ? (
            <>
              <Kpis data={dashboard.data} />
              <WorkflowMap
                statusMix={dashboard.data.statusMix}
                recentCases={dashboard.data.recentCases}
              />
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,.75fr)]">
                <ThroughputChart data={dashboard.data.trend} />
                <BottleneckPanel
                  statusMix={dashboard.data.statusMix}
                  data={exceptions.data}
                  loading={exceptions.isLoading}
                />
              </div>
              <div
                className={`grid gap-4 ${crm.data ? "2xl:grid-cols-[minmax(20rem,.72fr)_minmax(0,1.28fr)]" : ""}`}
              >
                <OutcomeHealth data={dashboard.data.outcomeMix} />
                {crm.data ? <CrmPulse data={crm.data} /> : null}
              </div>
              <CaseQueue
                items={cases.data?.items ?? []}
                loading={cases.isLoading}
                search={deferredSearch}
              />
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function CommandHeader({ generatedAt }: { generatedAt: string | undefined }) {
  return (
    <section className="surface flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700">
          <GitBranch className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-[-0.025em] sm:text-2xl">
              Operations command center
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
              <Radio className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Cases, bottlenecks, execution health and commercial movement in one view.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" />
        <span>
          Updated{" "}
          <strong className="font-semibold text-foreground">
            {generatedAt ? formatTime(generatedAt) : "Connecting…"}
          </strong>
        </span>
      </div>
    </section>
  );
}

function Kpis({ data }: { data: OperationsDashboard }) {
  const completed = (data.statusMix["COMPLETED"] ?? 0) + (data.statusMix["CLOSED"] ?? 0);
  const active = Math.max(0, data.summary.total - completed - (data.statusMix["CANCELLED"] ?? 0));
  const completionRate = data.summary.total
    ? Math.round((completed / data.summary.total) * 100)
    : 0;
  const items: Array<{
    label: string;
    value: number;
    suffix?: string;
    detail: string;
    icon: ComponentType<{ className?: string }>;
    iconClass: string;
  }> = [
    {
      label: "Active cases",
      value: active,
      detail: `${data.summary.total.toLocaleString("en-IN")} total portfolio`,
      icon: Database,
      iconClass: "bg-orange-100 text-orange-700",
    },
    {
      label: "In execution",
      value: data.statusMix["IN_PROGRESS"] ?? 0,
      detail: "verification work underway",
      icon: Activity,
      iconClass: "bg-blue-100 text-blue-700",
    },
    {
      label: "SLA overdue",
      value: data.summary.overdue,
      detail: data.summary.overdue ? "requires immediate action" : "no breached cases",
      icon: AlertTriangle,
      iconClass: data.summary.overdue ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-600",
    },
    {
      label: "Completion rate",
      value: completionRate,
      suffix: "%",
      detail: `${data.summary.completedToday} completed today`,
      icon: CheckCircle2,
      iconClass: "bg-emerald-100 text-emerald-700",
    },
  ];
  return (
    <section aria-label="Operations summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="surface rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {item.label}
            </p>
            <span className={`grid h-10 w-10 place-items-center rounded-full ${item.iconClass}`}>
              <item.icon className="h-4 w-4" />
            </span>
          </div>
          <p className="num mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {item.value.toLocaleString("en-IN")}
            {item.suffix ? (
              <span className="ml-0.5 text-xl text-muted-foreground">{item.suffix}</span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </article>
      ))}
    </section>
  );
}

function WorkflowMap({
  statusMix,
  recentCases,
}: {
  statusMix: Record<string, number>;
  recentCases: OperationsDashboard["recentCases"];
}) {
  const total = Object.values(statusMix).reduce((sum, count) => sum + count, 0);
  const stages = [
    { label: "Intake", keys: ["DRAFT"], color: "bg-stone-500", soft: "bg-stone-50" },
    {
      label: "Consent",
      keys: ["CONSENT_PENDING"],
      color: "bg-amber-500",
      soft: "bg-amber-50",
    },
    {
      label: "Execution",
      keys: ["IN_PROGRESS"],
      color: "bg-blue-500",
      soft: "bg-blue-50",
    },
    {
      label: "Quality review",
      keys: ["QA_PENDING"],
      color: "bg-violet-500",
      soft: "bg-violet-50",
    },
    {
      label: "Completed",
      keys: ["COMPLETED", "CLOSED"],
      color: "bg-emerald-500",
      soft: "bg-emerald-50",
    },
  ].map((stage) => ({
    ...stage,
    count: stage.keys.reduce((sum, key) => sum + (statusMix[key] ?? 0), 0),
  }));
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Live verification flow</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Current workload at every operational stage
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {total.toLocaleString("en-IN")} cases tracked
        </span>
      </div>

      <div className="mt-5 flex items-stretch gap-2 overflow-x-auto pb-2">
        {stages.map((stage, index) => (
          <div key={stage.label} className="contents">
            <article className={`min-w-40 flex-1 rounded-2xl p-4 ${stage.soft}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {total ? Math.round((stage.count / total) * 100) : 0}%
                </span>
              </div>
              <p className="num mt-5 text-2xl font-bold">{stage.count.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs font-semibold">{stage.label}</p>
            </article>
            {index < stages.length - 1 ? (
              <span className="grid shrink-0 place-items-center text-muted-foreground/50">
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {recentCases.length ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-orange-600" />
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Latest movement
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {recentCases.slice(0, 4).map((item) => (
              <Link
                key={item.id}
                to="/cases/$caseId"
                params={{ caseId: item.id }}
                className="rounded-xl border border-border bg-white p-3 transition hover:border-orange-200 hover:bg-orange-50/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold">{item.caseNumber}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${statusTone[item.status] ?? "bg-stone-100 text-stone-600"}`}
                  >
                    {humanize(item.status)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {item.subject.fullName} · {item.client.displayName}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Updated {relativeTime(item.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ThroughputChart({ data }: { data: OperationsDashboard["trend"] }) {
  const width = 640;
  const height = 210;
  const paddingX = 24;
  const paddingY = 22;
  const max = Math.max(1, ...data.flatMap((item) => [item.created, item.completed]));
  const points = (key: "created" | "completed") =>
    data.map((item, index) => ({
      x: paddingX + (index / Math.max(1, data.length - 1)) * (width - paddingX * 2),
      y: height - paddingY - (item[key] / max) * (height - paddingY * 2),
    }));
  const created = points("created");
  const completed = points("completed");
  const line = (items: typeof created) => items.map(({ x, y }) => `${x},${y}`).join(" ");
  const firstCreated = created[0];
  const lastCreated = created.at(-1);
  const area =
    firstCreated && lastCreated
      ? `M ${firstCreated.x} ${height - paddingY} L ${created
          .map(({ x, y }) => `${x} ${y}`)
          .join(" L ")} L ${lastCreated.x} ${height - paddingY} Z`
      : "";
  const createdTotal = data.reduce((sum, item) => sum + item.created, 0);
  const completedTotal = data.reduce((sum, item) => sum + item.completed, 0);
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">Execution throughput</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Six-month intake versus successful completion
          </p>
        </div>
        <div className="flex gap-5 text-xs">
          <MetricLegend label="Created" value={createdTotal} className="text-blue-700" />
          <MetricLegend label="Completed" value={completedTotal} className="text-emerald-700" />
        </div>
      </div>
      {data.length ? (
        <div className="mt-5">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-56 w-full overflow-visible"
            role="img"
            aria-label="Cases created and completed over six months"
          >
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1={paddingX}
                x2={width - paddingX}
                y1={height - paddingY - ratio * (height - paddingY * 2)}
                y2={height - paddingY - ratio * (height - paddingY * 2)}
                stroke="#eee7e1"
              />
            ))}
            <path d={area} fill="#eff6ff" />
            <polyline points={line(created)} fill="none" stroke="#3b82f6" strokeWidth="3" />
            <polyline points={line(completed)} fill="none" stroke="#10b981" strokeWidth="3" />
            {created.map((point, index) => {
              const completedPoint = completed[index];
              const item = data[index];
              if (!completedPoint || !item) return null;
              return (
                <g key={item.month}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#fff"
                    stroke="#3b82f6"
                    strokeWidth="3"
                  />
                  <circle
                    cx={completedPoint.x}
                    cy={completedPoint.y}
                    r="4"
                    fill="#fff"
                    stroke="#10b981"
                    strokeWidth="3"
                  />
                </g>
              );
            })}
          </svg>
          <div className="grid grid-cols-6 px-1 text-center text-[10px] font-semibold text-muted-foreground">
            {data.map((item) => (
              <span key={item.month}>{item.month}</span>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No throughput yet"
          text="Monthly data will appear here."
        />
      )}
    </section>
  );
}

function MetricLegend({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-bold ${className}`}>{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function BottleneckPanel({
  statusMix,
  data,
  loading,
}: {
  statusMix: Record<string, number>;
  data: ExceptionsDashboard | undefined;
  loading: boolean;
}) {
  const largest = Object.entries(statusMix)
    .filter(([status]) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(status))
    .sort((a, b) => b[1] - a[1])[0];
  const rows = [
    {
      label: "Overdue cases",
      value: data?.summary.overdue ?? 0,
      className: "bg-red-50 text-red-700",
    },
    {
      label: "Open clarifications",
      value: data?.summary.clarifications ?? 0,
      className: "bg-amber-50 text-amber-800",
    },
    {
      label: "Field exceptions",
      value: data?.summary.fieldExceptions ?? 0,
      className: "bg-violet-50 text-violet-700",
    },
  ];
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Bottleneck radar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Where work needs attention</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${row.className}`}
            >
              <span className="text-xs font-semibold">{row.label}</span>
              <span className="num text-lg font-bold">{row.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 rounded-xl border border-border bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Largest active queue
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold">
              {largest ? humanize(largest[0]) : "No active queue"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Current stage concentration</p>
          </div>
          <p className="num text-2xl font-bold">{largest?.[1] ?? 0}</p>
        </div>
      </div>
      <Link
        to="/exceptions"
        className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-orange-700 hover:underline"
      >
        Open exception workspace <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function OutcomeHealth({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  const clearRate = total ? Math.round(((data["CLEAR"] ?? 0) / total) * 100) : 0;
  const colors: Record<string, string> = {
    CLEAR: "bg-emerald-500",
    DISCREPANCY: "bg-red-500",
    INSUFFICIENT: "bg-amber-500",
    PENDING: "bg-stone-400",
  };
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-bold">Verification outcome health</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Result quality across all checks</p>
      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="grid h-32 w-32 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#10b981 0 ${clearRate}%, #f0ece8 ${clearRate}% 100%)`,
          }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center">
            <div>
              <p className="num text-2xl font-bold">{clearRate}%</p>
              <p className="text-[10px] font-semibold text-muted-foreground">Clear rate</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-3">
          {rows.length ? (
            rows.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between gap-4 text-xs">
                <span className="flex items-center gap-2 font-semibold">
                  <i className={`h-2.5 w-2.5 rounded-full ${colors[status] ?? "bg-blue-500"}`} />
                  {humanize(status)}
                </span>
                <span className="num font-bold">{count.toLocaleString("en-IN")}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No check outcomes recorded yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function CrmPulse({ data }: { data: CrmOverview }) {
  const stages = ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"].map(
    (stage) => data.stages.find((item) => item.stage === stage) ?? { stage, count: 0, value: 0 },
  );
  const maxCount = Math.max(1, ...stages.map((stage) => stage.count));
  const colors: Record<string, string> = {
    NEW: "bg-stone-400",
    QUALIFIED: "bg-blue-500",
    PROPOSAL: "bg-violet-500",
    NEGOTIATION: "bg-amber-500",
    WON: "bg-emerald-500",
    LOST: "bg-red-500",
  };
  return (
    <section className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">CRM conversion flow</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Opportunities moving from lead to commercial closure
          </p>
        </div>
        <Link
          to="/sales-crm"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:underline"
        >
          Open CRM <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric
          label="Open pipeline"
          value={money(data.summary.openValue)}
          icon={CircleDollarSign}
        />
        <MiniMetric
          label="Weighted value"
          value={money(data.summary.weightedValue)}
          icon={TrendingUp}
        />
        <MiniMetric label="Closed won" value={money(data.summary.wonValue)} icon={CheckCircle2} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stages.map((stage) => (
          <div key={stage.stage} className="rounded-xl bg-secondary/55 p-3">
            <div className="flex h-20 items-end">
              <div
                className={`w-full rounded-lg ${colors[stage.stage] ?? "bg-blue-500"}`}
                style={{ height: `${Math.max(8, (stage.count / maxCount) * 100)}%` }}
              />
            </div>
            <p className="num mt-2 text-lg font-bold">{stage.count}</p>
            <p className="truncate text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {humanize(stage.stage)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold">{label}</p>
      </div>
      <p className="num mt-2 truncate text-base font-bold">{value}</p>
    </div>
  );
}

function CaseQueue({
  items,
  loading,
  search,
}: {
  items: CaseListItem[];
  loading: boolean;
  search: string;
}) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-base font-bold">Live case register</h2>
          <p className="text-xs text-muted-foreground">
            {search ? `Results for “${search}”` : "Current assignment, due date and workflow state"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
          {items.length} shown
        </span>
      </div>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-bold">Case</th>
                <th className="px-4 py-3 font-bold">Candidate</th>
                <th className="px-4 py-3 font-bold">Client</th>
                <th className="px-4 py-3 font-bold">Checks</th>
                <th className="px-4 py-3 font-bold">Due</th>
                <th className="px-6 py-3 text-right font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const overdue =
                  Boolean(item.dueAt) &&
                  new Date(item.dueAt!).getTime() < Date.now() &&
                  !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-orange-50/35">
                    <td className="px-6 py-4">
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: item.id }}
                        className="font-bold hover:text-orange-700 hover:underline"
                      >
                        {item.caseNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {humanize(item.priority)} priority
                      </p>
                    </td>
                    <td className="px-4 py-4 font-semibold">{item.subject.fullName}</td>
                    <td className="px-4 py-4 text-muted-foreground">{item.client.displayName}</td>
                    <td className="px-4 py-4 text-muted-foreground">{item.checks.length}</td>
                    <td
                      className={`px-4 py-4 ${overdue ? "font-bold text-red-700" : "text-muted-foreground"}`}
                    >
                      {item.dueAt ? formatDate(item.dueAt) : "Not set"}
                      {overdue ? <span className="ml-1 text-[9px] uppercase">Overdue</span> : null}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[item.status] ?? "bg-stone-100 text-stone-600"}`}
                      >
                        {humanize(item.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          title={search ? "No matching cases" : "No cases created"}
          text={
            search
              ? "Try a case number, candidate name or client name."
              : "Use New case to start the first verification workflow."
          }
        />
      )}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading operations dashboard">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="surface h-32 animate-pulse rounded-2xl bg-card/70" />
        ))}
      </div>
      <div className="surface h-72 animate-pulse rounded-2xl bg-card/70" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="surface rounded-2xl border-red-200 p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-red-700" />
      <h2 className="mt-3 text-sm font-bold">Operations data could not be loaded</h2>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700"
      >
        Try again
      </button>
    </section>
  );
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function relativeTime(value: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
