import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Clock3, Layers3 } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildAdminExceptionRows,
  type AdminExceptionRow,
  type AdminExceptionSeverity,
} from "@/features/admin-dashboard/exception-oversight-data";
import {
  OversightEmpty,
  OversightMetric,
  OversightPager,
  OversightPanel,
  OversightPill,
  OversightSearch,
  type OversightTone,
} from "@/features/admin-dashboard/components/oversight-ui";
import { getExceptionsDashboard } from "@/lib/backend-api/dashboards";
import { formatRelativeToNow } from "@/lib/formatting";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/admin/exceptions")({
  head: () => ({
    meta: [
      { title: "Exception Oversight — Sapling Global" },
      {
        name: "description",
        content: "Live cross-workspace delivery risks and exception backlog.",
      },
    ],
  }),
  component: ExceptionOversightPage,
});

function ExceptionOversightPage() {
  const query = useQuery({
    queryKey: ["admin", "exception-oversight"],
    queryFn: getExceptionsDashboard,
    staleTime: 20_000,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return query.data
      ? buildAdminExceptionRows(query.data).filter((row) => {
          if (category !== "all" && row.category !== category) return false;
          return `${row.caseNumber} ${row.candidateName} ${row.clientName} ${row.issue}`
            .toLowerCase()
            .includes(term);
        })
      : [];
  }, [category, query.data, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exception oversight"
        description="One read-only queue for overdue cases, clarification delays and field exceptions across the platform."
      />

      {query.isError ? (
        <ErrorState
          title="Exception oversight unavailable"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isPending ? <CardGridSkeleton count={4} /> : null}
      {query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OversightMetric
              label="Open exceptions"
              value={query.data.summary.total}
              detail={`${query.data.summary.uniqueCases} unique cases`}
              icon={Layers3}
              tone="violet"
            />
            <OversightMetric
              label="Critical"
              value={query.data.summary.critical}
              detail="Requires immediate control"
              icon={CircleAlert}
              tone="rose"
            />
            <OversightMetric
              label="Average age"
              value={`${query.data.summary.averageAgeHours}h`}
              detail="Across current backlog"
              icon={Clock3}
              tone="amber"
            />
            <OversightMetric
              label="Resolved today"
              value={query.data.summary.resolvedToday}
              detail="Closed since start of day"
              icon={CheckCircle2}
              tone="mint"
            />
          </div>

          <OversightPanel
            title="Cross-workspace attention queue"
            description="Critical items first, then the oldest high-risk work."
            count={filtered.length}
            toolbar={
              <>
                <OversightSearch
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search exception or case"
                />
                <select
                  aria-label="Filter exception category"
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-full border border-border bg-neutral-soft/70 px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All categories</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Clarification">Clarification</option>
                  <option value="Field">Field</option>
                </select>
              </>
            }
          >
            {rows.length ? (
              <div className="divide-y divide-border/70 px-3 sm:px-5">
                {rows.map((row) => (
                  <ExceptionRow key={row.id} row={row} />
                ))}
              </div>
            ) : (
              <OversightEmpty
                title="No exception matches"
                detail="The queue is clear, or no item matches these filters."
              />
            )}
            <OversightPager
              page={safePage}
              canPrevious={safePage > 1}
              canNext={safePage < pages}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(pages, value + 1))}
            />
          </OversightPanel>
        </>
      ) : null}
    </div>
  );
}

function ExceptionRow({ row }: { row: AdminExceptionRow }) {
  return (
    <article className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1.2fr)_minmax(110px,.6fr)_minmax(110px,.6fr)] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{row.candidateName}</p>
          <OversightPill tone={severityTone(row.severity)}>{row.severity}</OversightPill>
          <OversightPill tone="neutral">{row.category}</OversightPill>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {row.caseNumber} · {row.clientName}
        </p>
      </div>
      <Detail label="Issue" value={row.issue} />
      <Detail label="Owner" value={row.owner} />
      <Detail label="Raised" value={formatRelativeToNow(row.raisedAt)} />
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function severityTone(value: AdminExceptionSeverity): OversightTone {
  if (value === "critical") return "rose";
  if (value === "high") return "amber";
  return "blue";
}
