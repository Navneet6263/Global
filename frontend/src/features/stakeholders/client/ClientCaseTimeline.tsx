import { useState } from "react";
import { Clock3, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseActivity } from "./client-case-activity";
import { activityKinds, caseDate } from "./client-case-activity";

export function ClientCaseTimeline({ events }: { events: CaseActivity[] }) {
  const [kind, setKind] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filtered = events.filter(
    (event) =>
      (kind === "All" || event.kind === kind) &&
      (event.title + " " + event.detail).toLowerCase().includes(search.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * 8, current * 8);
  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      aria-label="Case activity log"
    >
      <header className="border-b border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Activity timeline</h3>
            <p className="mt-1 text-xs text-slate-500">
              Recorded updates, newest first · All times in IST
            </p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            {events.length} events
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="relative min-w-[150px] flex-1">
            <Search className="absolute left-3 top-3 size-4 text-slate-400" aria-hidden />
            <input
              type="search"
              aria-label="Search case activity"
              placeholder="Search activity…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <select
            aria-label="Filter activity type"
            value={kind}
            onChange={(event) => {
              setKind(event.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs"
          >
            <option value="All">All activity</option>
            {activityKinds.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </header>
      <ol className="divide-y divide-slate-100 px-4">
        {visible.map((event) => (
          <li key={event.id} className="flex gap-3 py-4">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <Clock3 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-800">{event.title}</p>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  {event.kind}
                </span>
              </div>
              {event.detail && (
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">{event.detail}</p>
              )}
              <time dateTime={event.at} className="mt-1.5 block text-[11px] text-slate-500">
                {caseDate(event.at)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {!visible.length && (
        <div className="p-8 text-center">
          <Clock3 className="mx-auto mb-3 size-6 text-blue-300" />
          <p className="text-sm font-semibold">No matching activity</p>
          <p className="mt-1 text-xs text-slate-500">
            Try another filter. Events appear only when their timestamps are available.
          </p>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3 text-xs text-slate-500">
        <span>
          {filtered.length ? (current - 1) * 8 + 1 : 0}–{Math.min(current * 8, filtered.length)} of{" "}
          {filtered.length} events
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="size-8 rounded-lg"
            aria-label="Previous activity page"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span>
            {current} / {pages}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="size-8 rounded-lg"
            aria-label="Next activity page"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </footer>
      <p className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-[11px] leading-5 text-slate-500">
        Client-visible records only, not the internal audit log. Staff names and document-view
        events are not included in this data. Restricted or unavailable history is not shown.
      </p>
    </section>
  );
}
