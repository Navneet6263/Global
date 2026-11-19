import { useState } from "react";
import { Clock3, Search } from "lucide-react";
import { Button, Card, CardHeader, Chip, Input, Select } from "@/kit";
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
    <Card label="Case activity log">
      <CardHeader
        title="Activity timeline"
        description="Recorded updates, newest first · All times in IST"
        aside={<Chip tone="brand">{events.length} events</Chip>}
      />
      <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
        <label className="relative min-w-[150px] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search case activity"
            placeholder="Search activity…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </label>
        <Select
          aria-label="Filter activity type"
          value={kind}
          className="w-auto"
          onChange={(event) => {
            setKind(event.target.value);
            setPage(1);
          }}
        >
          <option value="All">All activity</option>
          {activityKinds.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>
      <ol className="divide-y divide-line px-4">
        {visible.map((event) => (
          <li key={event.id} className="flex gap-3 py-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
              <Clock3 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{event.title}</p>
                <Chip>{event.kind}</Chip>
              </div>
              {event.detail ? (
                <p className="mt-0.5 text-xs leading-5 break-words text-dim">{event.detail}</p>
              ) : null}
              <time dateTime={event.at} className="mt-1 block font-mono text-[11px] text-dim">
                {caseDate(event.at)}
              </time>
            </div>
          </li>
        ))}
      </ol>
      {!visible.length ? (
        <div className="p-8 text-center">
          <Clock3 className="mx-auto mb-3 size-6 text-dim/60" aria-hidden />
          <p className="text-sm font-semibold text-ink">No matching activity</p>
          <p className="mt-1 text-xs text-dim">
            Try another filter. Events appear only when their timestamps are available.
          </p>
        </div>
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-dim">
        <span>
          {filtered.length ? (current - 1) * 8 + 1 : 0}–{Math.min(current * 8, filtered.length)} of{" "}
          {filtered.length} events
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            aria-label="Previous activity page"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <span>
            {current} / {pages}
          </span>
          <Button
            size="sm"
            aria-label="Next activity page"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </footer>
      <p className="border-t border-line bg-subtle/40 px-4 py-3 text-xs leading-5 text-dim">
        Client-visible records only, not the internal audit log. Staff names and document-view
        events are not included in this data. Restricted or unavailable history is not shown.
      </p>
    </Card>
  );
}
