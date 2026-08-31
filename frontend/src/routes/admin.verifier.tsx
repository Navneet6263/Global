import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CircleAlert, ClipboardList, Users } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import {
  CapacityBar,
  OversightEmpty,
  OversightMetric,
  OversightPager,
  OversightPanel,
  OversightSearch,
} from "@/features/admin-dashboard/components/oversight-ui";
import { useOpsTeam } from "@/features/operations/hooks/use-operations";

const PAGE_SIZE = 7;

export const Route = createFileRoute("/admin/verifier")({
  head: () => ({
    meta: [
      { title: "Verifier Operations — Sapling Global" },
      { name: "description", content: "Live verifier workload and delivery risk." },
    ],
  }),
  component: VerifierOversightPage,
});

function VerifierOversightPage() {
  const query = useOpsTeam();
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.members ?? [])
      .filter((member) => {
        if (risk === "overdue") return member.overdue > 0;
        if (risk === "active") return member.activeChecks > 0;
        if (risk === "clear") return member.activeChecks === 0 && member.overdue === 0;
        return true;
      })
      .filter((member) => `${member.name} ${member.branch}`.toLowerCase().includes(term))
      .sort((a, b) => b.overdue - a.overdue || b.activeChecks - a.activeChecks);
  }, [query.data?.members, risk, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Verifier operations"
        description="A compact control view of allocation pressure and check execution. Verifiers keep their own task workspace."
      />

      {query.isError ? (
        <ErrorState
          title="Verifier oversight unavailable"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isPending ? <CardGridSkeleton count={4} /> : null}
      {query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OversightMetric
              label="Verifier accounts"
              value={query.data.members.length}
              detail="Available in this tenant"
              icon={Users}
              tone="mint"
            />
            <OversightMetric
              label="Checks in flight"
              value={sum(query.data.members, (member) => member.activeChecks)}
              detail="Across verifier queues"
              icon={ClipboardList}
              tone="blue"
            />
            <OversightMetric
              label="Awaiting allocation"
              value={query.data.openAssignments}
              detail="Checks without an owner"
              icon={BadgeCheck}
              tone="amber"
            />
            <OversightMetric
              label="Overdue checks"
              value={sum(query.data.members, (member) => member.overdue)}
              detail="Needs operations attention"
              icon={CircleAlert}
              tone="rose"
            />
          </div>

          <OversightPanel
            title="Workload and risk queue"
            description="Highest overdue and highest-load verifiers appear first."
            count={filtered.length}
            toolbar={
              <>
                <OversightSearch
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search verifier or branch"
                />
                <select
                  aria-label="Filter verifier workload"
                  value={risk}
                  onChange={(event) => {
                    setRisk(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-full border border-border bg-neutral-soft/70 px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All workload</option>
                  <option value="overdue">Has overdue</option>
                  <option value="active">Has open checks</option>
                  <option value="clear">No open checks</option>
                </select>
              </>
            }
          >
            {rows.length ? (
              <div className="divide-y divide-border/70 px-3 sm:px-5">
                {rows.map((member) => (
                  <article
                    key={member.id}
                    className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(78px,.45fr))_minmax(140px,.8fr)] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-mint/20 bg-mint-soft text-xs font-semibold text-mint-deep">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.branch}</p>
                      </div>
                    </div>
                    <Datum label="Active checks" value={member.activeChecks} />
                    <Datum label="Overdue" value={member.overdue} danger={member.overdue > 0} />
                    <Datum label="Done today" value={member.completedToday} />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
                          Relative load
                        </span>
                        <span className="num text-xs font-semibold">
                          {member.relativeLoadPercent}%
                        </span>
                      </div>
                      <CapacityBar
                        value={member.relativeLoadPercent}
                        tone={member.overdue > 0 ? "rose" : "mint"}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <OversightEmpty
                title="No verifier matches"
                detail="Change the search or workload filter to widen this oversight view."
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

function Datum({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className={`num mt-1 text-sm font-semibold ${danger ? "text-critical-foreground" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function sum<T>(rows: readonly T[], select: (row: T) => number) {
  return rows.reduce((total, row) => total + select(row), 0);
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
