import { useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ClientAnalyticsDashboard } from "@/lib/backend-api/dashboards";

export function ClientBranchComparison({ rows }: { rows: ClientAnalyticsDashboard["branches"] }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) =>
    `${row.name} ${row.city ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6));
  const current = Math.min(page, pages);
  return (
    <section className="rounded-3xl border border-info/20 bg-gradient-to-br from-info-soft/30 to-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-info" /> Delivery branch comparison
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Only your organisation's cases, grouped by assigned operating branch. Completion is
            completed / all cases; overdue includes active cases only.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border border-border bg-card px-3">
          <Search className="size-3.5" />
          <input
            aria-label="Search delivery branches"
            className="h-9 w-40 bg-transparent text-xs outline-none"
            placeholder="Branch or city"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.slice((current - 1) * 6, current * 6).map((row) => (
          <article
            key={row.id ?? "unassigned"}
            className={`rounded-2xl border bg-card p-4 ${row.overdue ? "border-warning/30" : "border-mint/25"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="truncate text-sm font-semibold">{row.name}</h3>
              <span className="rounded-full bg-info-soft px-2 py-1 text-[10px] text-info-foreground">
                {row.total} cases
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {row.city ?? "Location not recorded"}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Metric label="Active" value={row.active} />
              <Metric label="Completed" value={row.completed} />
              <Metric label="Overdue" value={row.overdue} />
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-mint"
                style={{ width: `${row.completionPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              {row.completionPercent}% completed · {row.pendingDocuments} documents pending ·{" "}
              {row.clarifications} clarifications · {row.cancelled} cancelled
            </p>
          </article>
        ))}
      </div>
      {!filtered.length ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No matching branch data yet.
        </p>
      ) : null}
      <footer className="mt-3 flex justify-end gap-2 text-xs">
        <span className="self-center text-muted-foreground">
          Page {current} of {pages}
        </span>
        <button
          aria-label="Previous branches"
          disabled={current <= 1}
          onClick={() => setPage(current - 1)}
          className="rounded-full border border-border bg-card p-2 disabled:opacity-30"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <button
          aria-label="Next branches"
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
          className="rounded-full border border-border bg-card p-2 disabled:opacity-30"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </footer>
    </section>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="num text-lg font-semibold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
