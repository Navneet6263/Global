import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileCheck2, ShieldCheck, TimerReset } from "lucide-react";

import { ColumnChart, KpiStrip, MeterRow, PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getSession } from "@/lib/api/auth";
import { listCases } from "@/lib/api/cases";
import { saveBlob } from "@/lib/api/client";
import { getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal")({
  head: () => ({ meta: [{ title: "Client Portal — Sapling Global Verification" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const dashboard = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const cases = useQuery({
    queryKey: ["cases", "client-portal"],
    queryFn: () => listCases({ limit: 100 }),
  });
  const data = dashboard.data;
  const rows = cases.data?.items ?? [];
  const finished = rows.filter((item) => ["COMPLETED", "CLOSED"].includes(item.status)).length;
  const active = rows.filter(
    (item) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status),
  ).length;
  const progress = (item: (typeof rows)[number]) =>
    item.checks.length
      ? Math.round(
          (item.checks.filter((check) => check.status === "COMPLETED").length /
            item.checks.length) *
            100,
        )
      : 0;
  const refresh = () => {
    void dashboard.refetch();
    void cases.refetch();
  };

  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={refresh} isRefreshing={dashboard.isFetching || cases.isFetching} />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <PageHeader
            title="Verification workspace"
            subtitle={`${session.data?.displayName ?? "Authorised user"} · tenant-scoped case portfolio`}
            chip={data ? `Live · ${formatTime(data.generatedAt)}` : "Loading live data"}
          />
          {dashboard.isError || cases.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {dashboard.error?.message ?? cases.error?.message}
            </div>
          ) : null}
          <KpiStrip
            items={[
              {
                label: "Portfolio",
                value: String(data?.summary.total ?? 0),
                delta: `${active} active`,
                tone: "info",
              },
              {
                label: "Completed",
                value: String(finished),
                delta: `${data?.summary.completedToday ?? 0} today`,
                tone: "success",
              },
              {
                label: "Awaiting action",
                value: String(data?.statusMix["CLARIFICATION_PENDING"] ?? 0),
                delta: "clarifications",
                tone: "warning",
              },
              {
                label: "Overdue",
                value: String(data?.summary.overdue ?? 0),
                delta: "needs attention",
                tone: data?.summary.overdue ? "destructive" : "success",
              },
            ]}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Cases initiated"
              subtitle="Actual monthly case volume"
            >
              <ColumnChart
                data={(data?.trend ?? []).map((point) => ({
                  label: point.month,
                  value: point.created,
                  tone: "info" as const,
                }))}
              />
            </Panel>
            <Panel title="Outcome mix" subtitle="Completed verification check results">
              <OutcomeMix values={data?.outcomeMix ?? {}} />
            </Panel>
          </div>

          <Panel
            title="Candidates"
            subtitle="Live progress across authorised cases"
            action={
              rows.length ? (
                <button
                  type="button"
                  onClick={() => exportCases(rows)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-4 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              ) : undefined
            }
          >
            {cases.isLoading ? (
              <div className="h-64 animate-pulse rounded-2xl bg-secondary" />
            ) : rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Candidate</th>
                      <th className="py-2 pr-3 font-medium">Case</th>
                      <th className="py-2 pr-3 font-medium">Progress</th>
                      <th className="py-2 pr-3 font-medium">Due</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id} className="border-t border-border/60">
                        <td className="py-3 pr-3">
                          <Link
                            to="/cases/$caseId"
                            params={{ caseId: item.id }}
                            className="font-medium hover:underline"
                          >
                            {item.subject.fullName}
                          </Link>
                          <p className="text-[11px] text-muted-foreground">
                            {item.subject.employeeCode || "No employee code"}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {item.caseNumber}
                        </td>
                        <td className="w-44 py-3 pr-3">
                          <MeterRow
                            label=""
                            hint={`${progress(item)}%`}
                            value={progress(item)}
                            tone={progress(item) === 100 ? "success" : "info"}
                          />
                        </td>
                        <td className="py-3 pr-3 text-xs text-muted-foreground">
                          {item.dueAt ? formatDate(item.dueAt) : "Not set"}
                        </td>
                        <td className="py-3">
                          <Status value={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border py-14 text-center">
                <FileCheck2 className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No verification cases yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Initiate the first case when candidate details are ready.
                </p>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Data isolation" subtitle="Your organisation’s access boundary">
              <div className="flex items-center gap-3 rounded-2xl bg-accent/15 p-4">
                <ShieldCheck className="h-6 w-6 shrink-0 text-accent-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Cases, documents and reports are server-scoped to your assigned client account and
                  audited on every access.
                </p>
              </div>
            </Panel>
            <Panel title="Turnaround attention" subtitle="Operational items that may affect SLA">
              <div className="flex items-center gap-3 rounded-2xl bg-secondary/55 p-4">
                <TimerReset className="h-6 w-6 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-5 text-muted-foreground">
                  {data?.summary.overdue
                    ? `${data.summary.overdue} case(s) are beyond their due date. Open the case record for current blockers.`
                    : "No active case is currently beyond its due date."}
                </p>
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function OutcomeMix({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!entries.length || !total)
    return (
      <p className="py-10 text-center text-xs text-muted-foreground">
        No check outcomes recorded yet.
      </p>
    );
  return (
    <div className="space-y-4">
      {entries.map(([label, value]) => (
        <MeterRow
          key={label}
          label={humanize(label)}
          hint={`${value}`}
          value={(value / total) * 100}
          tone={label === "CLEAR" ? "success" : label === "DISCREPANCY" ? "destructive" : "warning"}
        />
      ))}
    </div>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
      {humanize(value)}
    </span>
  );
}
function exportCases(rows: Awaited<ReturnType<typeof listCases>>["items"]) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    ["Case number", "Candidate", "Status", "Priority", "Due date"],
    ...rows.map((item) => [
      item.caseNumber,
      item.subject.fullName,
      item.status,
      item.priority,
      item.dueAt ?? "",
    ]),
  ]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "sapling-global-cases.csv");
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
