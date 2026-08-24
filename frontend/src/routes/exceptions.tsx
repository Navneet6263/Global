import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Clock3,
  MapPin,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import { PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getExceptionsDashboard, type ExceptionsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/exceptions")({
  head: () => ({ meta: [{ title: "Exceptions — Sapling Global" }] }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  const query = useQuery({
    queryKey: ["dashboard", "exceptions"],
    queryFn: getExceptionsDashboard,
    refetchInterval: 30_000,
  });
  const data = query.data;
  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
        <main className="flex-1 space-y-5 px-4 pb-10 sm:px-6">
          <PageHeader
            title="Exception command centre"
            subtitle="Actionable SLA, candidate-response and field-geofence queues"
            chip={data ? `Live · ${formatDateTime(data.generatedAt)}` : "Loading live queue"}
          />
          {query.isLoading ? <Skeleton /> : null}
          {query.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {query.error.message}
            </div>
          ) : null}
          {data ? <ExceptionContent data={data} /> : null}
        </main>
      </div>
    </div>
  );
}

function ExceptionContent({ data }: { data: ExceptionsDashboard }) {
  const metrics = [
    { label: "Total action queue", value: data.summary.total, icon: AlertTriangle },
    { label: "Overdue cases", value: data.summary.overdue, icon: Clock3 },
    { label: "Clarifications", value: data.summary.clarifications, icon: MessageSquareText },
    { label: "Field exceptions", value: data.summary.fieldExceptions, icon: MapPin },
  ];
  return (
    <>
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Exception summary">
        {metrics.map((metric) => (
          <article key={metric.label} className="surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight">{metric.value}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Candidate clarifications"
          subtitle="Responses awaiting review and open requests"
        >
          <Queue
            empty="No candidate clarifications require action"
            items={data.clarifications.map((item) => ({
              id: item.id,
              caseId: item.case.publicId,
              title: item.subject,
              detail: `${item.case.caseNumber} · ${item.case.subject.fullName}`,
              meta:
                item.status === "RESPONDED" ? "Response ready for review" : dueLabel(item.dueAt),
              status: item.status,
            }))}
          />
        </Panel>
        <Panel
          title="Field geofence review"
          subtitle="Visits completed outside the permitted radius"
        >
          <Queue
            empty="No field visits require exception review"
            items={data.fieldVisits.map((item) => ({
              id: item.id,
              caseId: item.case.publicId,
              title: item.address,
              detail: `${item.case.caseNumber} · ${item.assignee?.displayName ?? "Unassigned"}`,
              meta:
                item.distanceMeters == null
                  ? "Distance unavailable"
                  : `${Math.round(item.distanceMeters)} m captured · ${item.geofenceMeters} m radius`,
              status: "EXCEPTION_REVIEW",
            }))}
          />
        </Panel>
      </div>

      <Panel title="Overdue cases" subtitle="Open cases beyond their committed due date">
        <Queue
          empty="No cases are overdue"
          items={data.overdue.map((item) => ({
            id: item.id,
            caseId: item.id,
            title: item.subject.fullName,
            detail: `${item.caseNumber} · ${item.client.displayName}`,
            meta: `Due ${formatDateTime(item.dueAt)} · ${humanize(item.priority)} priority`,
            status: item.status,
          }))}
        />
      </Panel>
    </>
  );
}

function Queue({
  items,
  empty,
}: {
  items: Array<{
    id: string;
    caseId: string;
    title: string;
    detail: string;
    meta: string;
    status: string;
  }>;
  empty: string;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <ShieldCheck className="mx-auto h-5 w-5 text-accent-foreground" />
        <p className="mt-2 text-xs text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--hairline)]">
      {items.map((item) => (
        <Link
          key={item.id}
          to="/cases/$caseId"
          params={{ caseId: item.caseId }}
          className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning-foreground">
            <AlertCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.meta}</p>
          </div>
          <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold sm:inline">
            {humanize(item.status)}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-3xl bg-card" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-3xl bg-card" />
    </div>
  );
}

function dueLabel(value?: string | null) {
  return value ? `Due ${formatDateTime(value)}` : "No response due date";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
