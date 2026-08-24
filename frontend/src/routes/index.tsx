import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  Radio,
  SearchX,
} from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { listCases, type CaseListItem } from "@/lib/api/cases";
import { getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sapling Global — Verification Operations Control Tower" },
      {
        name: "description",
        content:
          "Live verification operations, workload, SLA risk and case progress for Sapling Global.",
      },
    ],
  }),
  component: OperationsDashboard,
});

const statusTone: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  CONSENT_PENDING: "bg-warning/20 text-warning-foreground",
  IN_PROGRESS: "bg-info/12 text-info",
  QA_PENDING: "bg-violet-500/10 text-violet-700",
  COMPLETED: "bg-accent/25 text-accent-foreground",
  CLOSED: "bg-accent/25 text-accent-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

function OperationsDashboard() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const dashboard = useQuery({
    queryKey: ["dashboard", "operations"],
    queryFn: getOperationsDashboard,
    refetchInterval: 60_000,
  });
  const cases = useQuery({
    queryKey: ["cases", { search: deferredSearch }],
    queryFn: () =>
      listCases(deferredSearch ? { search: deferredSearch, limit: 25 } : { limit: 25 }),
  });
  const refreshing = dashboard.isFetching || cases.isFetching;
  const refresh = () => {
    void dashboard.refetch();
    void cases.refetch();
  };

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={refresh}
          isRefreshing={refreshing}
        />

        <main className="flex-1 space-y-5 px-4 pb-10 pt-5 sm:px-5">
          <Hero generatedAt={dashboard.data?.generatedAt} />

          {dashboard.isLoading ? <DashboardSkeleton /> : null}
          {dashboard.isError ? (
            <ErrorState message={dashboard.error.message} onRetry={refresh} />
          ) : null}
          {dashboard.data ? (
            <>
              <Kpis summary={dashboard.data.summary} />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(18rem,0.75fr)]">
                <ThroughputChart data={dashboard.data.trend} />
                <StatusMix data={dashboard.data.statusMix} />
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

function Hero({ generatedAt }: { generatedAt: string | undefined }) {
  return (
    <section className="ink-panel relative overflow-hidden rounded-[2rem] p-6 shadow-[var(--shadow-float)] sm:p-8">
      <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-info/20 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em]">
            <Radio className="h-3 w-3 text-accent" /> Live operations
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Verification control tower
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 opacity-70">
            One operational view of every active case, turnaround risk and completion event in your
            authorised workspace.
          </p>
        </div>
        <div className="rounded-2xl bg-primary-foreground/8 px-4 py-3 backdrop-blur">
          <p className="text-[10px] uppercase tracking-[0.12em] opacity-55">Data freshness</p>
          <p className="mt-1 text-sm font-semibold">
            {generatedAt
              ? new Intl.DateTimeFormat("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  timeZoneName: "short",
                }).format(new Date(generatedAt))
              : "Connecting…"}
          </p>
        </div>
      </div>
    </section>
  );
}

function Kpis({
  summary,
}: {
  summary: { total: number; overdue: number; createdToday: number; completedToday: number };
}) {
  const items = [
    { label: "Total cases", value: summary.total, icon: Database, tone: "text-foreground" },
    {
      label: "Overdue",
      value: summary.overdue,
      icon: AlertTriangle,
      tone: summary.overdue ? "text-destructive" : "text-muted-foreground",
    },
    { label: "Created today", value: summary.createdToday, icon: ArrowUpRight, tone: "text-info" },
    {
      label: "Completed today",
      value: summary.completedToday,
      icon: CheckCircle2,
      tone: "text-accent-foreground",
    },
  ];
  return (
    <section aria-label="Operations summary" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="surface rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <item.icon className={`h-4 w-4 ${item.tone}`} />
          </div>
          <p className="num mt-3 text-3xl font-bold">{item.value.toLocaleString("en-IN")}</p>
        </article>
      ))}
    </section>
  );
}

function ThroughputChart({
  data,
}: {
  data: Array<{ month: string; created: number; completed: number }>;
}) {
  const max = Math.max(1, ...data.flatMap((item) => [item.created, item.completed]));
  return (
    <section className="surface rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Six-month throughput</h2>
          <p className="text-xs text-muted-foreground">Cases created versus completed</p>
        </div>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-info" />
            Created
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full bg-accent" />
            Completed
          </span>
        </div>
      </div>
      <div className="mt-8 flex h-56 items-end gap-3 sm:gap-5">
        {data.map((item) => (
          <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="flex min-h-0 flex-1 items-end justify-center gap-1 sm:gap-2">
              <div
                title={`${item.created} created`}
                className="w-1/2 rounded-t-xl bg-info/80"
                style={{ height: `${Math.max(3, (item.created / max) * 100)}%` }}
              />
              <div
                title={`${item.completed} completed`}
                className="w-1/2 rounded-t-xl bg-accent"
                style={{ height: `${Math.max(3, (item.completed / max) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground">
              {item.month}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusMix({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="surface rounded-3xl p-5 sm:p-6">
      <h2 className="text-sm font-semibold">Case status</h2>
      <p className="text-xs text-muted-foreground">Current operational distribution</p>
      {rows.length ? (
        <div className="mt-6 space-y-4">
          {rows.map(([status, count]) => (
            <div key={status}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium">{humanize(status)}</span>
                <span className="num text-muted-foreground">{count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total ? Math.max(3, (count / total) * 100) : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No cases yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create the first case to begin tracking.
          </p>
        </div>
      )}
    </section>
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
    <section className="surface overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-4 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold">Case queue</h2>
          <p className="text-xs text-muted-foreground">
            {search ? `Results for “${search}”` : "Most recently updated cases"}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          {items.length} shown
        </span>
      </div>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-secondary/55 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">Candidate</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Checks</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-6 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-secondary/35">
                  <td className="px-6 py-4">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: item.id }}
                      className="font-semibold hover:underline"
                    >
                      {item.caseNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {humanize(item.priority)}
                    </p>
                  </td>
                  <td className="px-4 py-4 font-medium">{item.subject.fullName}</td>
                  <td className="px-4 py-4 text-muted-foreground">{item.client.displayName}</td>
                  <td className="px-4 py-4 text-muted-foreground">{item.checks.length}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {item.dueAt ? formatDate(item.dueAt) : "Not set"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[item.status] ?? "bg-secondary text-muted-foreground"}`}
                    >
                      {humanize(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid place-items-center px-6 py-16 text-center">
          <SearchX className="h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">
            {search ? "No matching cases" : "No cases created"}
          </p>
          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            {search
              ? "Try a case number, candidate name or client name."
              : "Use New case to start the first verification workflow."}
          </p>
        </div>
      )}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading operations dashboard">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="surface h-28 animate-pulse rounded-3xl bg-card/70" />
        ))}
      </div>
      <div className="surface h-72 animate-pulse rounded-3xl bg-card/70" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="surface rounded-3xl border-destructive/20 p-8 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-destructive" />
      <h2 className="mt-3 text-sm font-semibold">Operations data could not be loaded</h2>
      <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-muted-foreground">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
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
