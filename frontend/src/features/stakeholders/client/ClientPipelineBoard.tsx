import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, Chip, DOT, ErrorText, Input, Loading, Meter } from "@/kit";
import { listCases, type CaseListItem } from "@/lib/api/cases";
import { cn } from "@/lib/utils";
import { clientStatus, tatText } from "./client-portal-utils";
import { ClientSummary } from "./ClientPageParts";
import { PIPELINE_COLUMNS, groupPipeline, waitingDays, waitingLevel } from "./pipeline-model";

const LIMIT = 100;

function BoardCard({ item, now, onOpen }: { item: CaseListItem; now: Date; onOpen: () => void }) {
  const done = item.checks.filter((check) => check.status === "COMPLETED").length;
  const level = waitingLevel(item, now);
  const days = waitingDays(item, now);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open case for ${item.subject.fullName}`}
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-lg border bg-surface p-3 text-left shadow-soft transition hover:-translate-y-px hover:border-brand/40",
        level === "late" ? "border-bad/40" : level === "stuck" ? "border-warn/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={item.subject.fullName} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.subject.fullName}</p>
          <p className="font-mono text-[11px] text-dim">{item.caseNumber}</p>
        </div>
      </div>
      <p className="text-xs text-dim">{clientStatus(item).label}</p>
      <div className="flex flex-col gap-1">
        <span className="flex justify-between font-mono text-[11px] text-dim">
          <span>
            {done}/{item.checks.length} checks
          </span>
          <span>{tatText(item.tatWorkingDays)}</span>
        </span>
        <Meter
          value={done}
          max={item.checks.length}
          tone={done === item.checks.length && done ? "good" : "brand"}
          label={`${done} of ${item.checks.length} checks done`}
        />
      </div>
      {level !== "ok" ? (
        <Chip tone={level === "late" ? "bad" : "warn"} dot className="self-start">
          No movement for {days} days
        </Chip>
      ) : item.report ? (
        <Chip tone="good" dot className="self-start">
          Report ready
        </Chip>
      ) : null}
    </button>
  );
}

/** Every case as a board by stage, so the client sees at a glance where work is stuck. */
export function ClientPipelineBoard({ onOpen }: { onOpen: (caseId: string) => void }) {
  const [filter, setFilter] = useState("");
  const cases = useQuery({
    queryKey: ["cases", "client-pipeline", LIMIT],
    queryFn: ({ signal }) =>
      listCases(
        { page: 1, pageSize: LIMIT, limit: LIMIT, sortBy: "updatedAt", sortDir: "desc" },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
  const now = useMemo(() => new Date(), []);
  const items = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return (cases.data?.items ?? []).filter(
      (item) => !term || `${item.subject.fullName} ${item.caseNumber}`.toLowerCase().includes(term),
    );
  }, [cases.data, filter]);
  const { columns, hidden } = groupPipeline(items, now);
  const stuck = items.filter((item) => waitingLevel(item, now) !== "ok");
  const late = items.filter((item) => waitingLevel(item, now) === "late");

  if (cases.isPending) return <Loading>Loading your pipeline…</Loading>;
  if (cases.isError)
    return (
      <ErrorText onRetry={() => void cases.refetch()} retrying={cases.isFetching}>
        {cases.error.message}
      </ErrorText>
    );
  return (
    <>
      <ClientSummary
        items={[
          { label: "On the board", value: items.length - hidden, detail: "Latest cases" },
          {
            label: "Needs you",
            value: columns.needsYou.length,
            detail: "Approve or answer",
            tone: columns.needsYou.length ? "amber" : "green",
          },
          {
            label: "Not moving 5+ days",
            value: stuck.length,
            detail: `${late.length} for 10+ days`,
            tone: stuck.length ? "red" : "green",
          },
          { label: "Completed", value: columns.done.length, tone: "green" },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Filter the board</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
            aria-hidden
          />
          <Input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a candidate or case"
            className="pl-9"
          />
        </label>
        <span className="text-xs text-dim">
          {cases.data && cases.data.total > LIMIT
            ? `Showing the ${LIMIT} most recently updated of ${cases.data.total} cases.`
            : "Cards that have not moved the longest are at the top of each column."}
        </span>
      </div>
      <div
        role="region"
        aria-label="Pipeline board"
        tabIndex={0}
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2"
      >
        {PIPELINE_COLUMNS.map((column) => (
          <section
            key={column.key}
            aria-label={column.label}
            className="flex w-[272px] shrink-0 flex-col gap-2 rounded-xl border border-line bg-subtle/50 p-2"
          >
            <header className="px-1.5 pt-1">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={cn("size-2 rounded-full", DOT[column.tone])} aria-hidden />
                {column.label}
                <span className="ml-auto rounded-full bg-surface px-2 font-mono text-xs text-dim">
                  {columns[column.key].length}
                </span>
              </h2>
              <p className="text-[11px] text-dim">{column.hint}</p>
            </header>
            <div className="flex max-h-[calc(100dvh-320px)] min-h-24 flex-col gap-2 overflow-y-auto">
              {columns[column.key].map((item) => (
                <BoardCard key={item.id} item={item} now={now} onOpen={() => onOpen(item.id)} />
              ))}
              {!columns[column.key].length ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-dim">
                  Nothing here
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
