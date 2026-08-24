import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Gauge, ShieldCheck } from "lucide-react";

import { ColumnChart, KpiStrip, MeterRow, PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getExecutiveDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/executive")({
  head: () => ({ meta: [{ title: "Executive overview — Sapling Global" }] }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const query = useQuery({ queryKey: ["dashboard", "executive"], queryFn: getExecutiveDashboard });
  const data = query.data;
  const statusEntries = Object.entries(data?.statusMix ?? {});
  const riskEntries = Object.entries(data?.riskMix ?? {});
  const statusTotal = statusEntries.reduce((sum, [, value]) => sum + value, 0);
  const riskTotal = riskEntries.reduce((sum, [, value]) => sum + value, 0);
  return (
    <div className="min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <PageHeader
            title="Executive overview"
            subtitle="Tenant-wide verification delivery and risk performance"
            chip={data ? `Live · ${formatTime(data.generatedAt)}` : "Loading live data"}
          />
          {query.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {query.error.message}
            </div>
          ) : null}
          <KpiStrip
            items={[
              {
                label: "Cases",
                value: String(data?.summary.total ?? 0),
                delta: `${data?.summary.createdToday ?? 0} created today`,
                tone: "info",
              },
              {
                label: "On-time SLA",
                value: `${data?.performance.slaPercentage ?? 0}%`,
                delta: `${data?.performance.completedCases ?? 0} completed`,
                tone: (data?.performance.slaPercentage ?? 100) >= 90 ? "success" : "warning",
              },
              {
                label: "Average TAT",
                value: `${data?.performance.averageTatHours ?? 0}h`,
                delta: "completed cases",
                tone: "info",
              },
              {
                label: "Overdue",
                value: String(data?.summary.overdue ?? 0),
                delta: "active cases",
                tone: data?.summary.overdue ? "destructive" : "success",
              },
            ]}
          />
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Case intake"
              subtitle="Actual cases created by month"
            >
              <ColumnChart
                data={(data?.trend ?? []).map((point) => ({
                  label: point.month,
                  value: point.created,
                  tone: "info" as const,
                }))}
              />
            </Panel>
            <Panel title="Delivery health" subtitle="Current operational indicators">
              <div className="space-y-3">
                <Health
                  icon={CheckCircle2}
                  label="Completed today"
                  value={String(data?.summary.completedToday ?? 0)}
                />
                <Health
                  icon={Clock3}
                  label="Average turnaround"
                  value={`${data?.performance.averageTatHours ?? 0} hours`}
                />
                <Health
                  icon={AlertTriangle}
                  label="Overdue active cases"
                  value={String(data?.summary.overdue ?? 0)}
                  danger={Boolean(data?.summary.overdue)}
                />
                <Health
                  icon={ShieldCheck}
                  label="SLA adherence"
                  value={`${data?.performance.slaPercentage ?? 0}%`}
                />
              </div>
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Workflow distribution" subtitle="Cases by current lifecycle state">
              <Mix entries={statusEntries} total={statusTotal} />
            </Panel>
            <Panel title="Risk distribution" subtitle="Latest case-level risk classification">
              <Mix entries={riskEntries} total={riskTotal} risk />
            </Panel>
          </div>
          <Panel title="Recently updated cases" subtitle="Latest portfolio movement">
            {data?.recentCases.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Case</th>
                      <th className="py-2 pr-3 font-medium">Candidate</th>
                      <th className="py-2 pr-3 font-medium">Client</th>
                      <th className="py-2 pr-3 font-medium">Priority</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCases.map((item) => (
                      <tr key={item.id} className="border-t border-border/60">
                        <td className="py-3 pr-3">
                          <Link
                            to="/cases/$caseId"
                            params={{ caseId: item.id }}
                            className="font-semibold hover:underline"
                          >
                            {item.caseNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-3">{item.subject.fullName}</td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {item.client.displayName}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">
                          {humanize(item.priority)}
                        </td>
                        <td className="py-3">
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                            {humanize(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border py-12 text-center">
                <Gauge className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No cases recorded yet</p>
              </div>
            )}
          </Panel>
        </main>
      </div>
    </div>
  );
}

function Mix({
  entries,
  total,
  risk = false,
}: {
  entries: Array<[string, number]>;
  total: number;
  risk?: boolean;
}) {
  if (!entries.length || !total)
    return <p className="py-10 text-center text-xs text-muted-foreground">No data recorded yet.</p>;
  return (
    <div className="space-y-4">
      {entries.map(([label, value]) => (
        <MeterRow
          key={label}
          label={humanize(label)}
          hint={`${value}`}
          value={(value / total) * 100}
          tone={
            risk && ["HIGH", "CRITICAL"].includes(label)
              ? "destructive"
              : label === "COMPLETED" || label === "LOW"
                ? "success"
                : "info"
          }
        />
      ))}
    </div>
  );
}
function Health({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary/50 p-3">
      <span
        className={`grid h-9 w-9 place-items-center rounded-full ${danger ? "bg-destructive/10 text-destructive" : "bg-background text-muted-foreground"}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
