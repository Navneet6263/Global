import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleCheck, Search } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import {
  getUnifiedDataEntryQueue,
  type DataEntryQueueFilter,
  type UnifiedQueueCase,
} from "@/lib/backend-api/data-entry-queue";
import { getDataEntryOverview } from "@/lib/backend-api/workflow";
import { DataEntryIntakeReview } from "./DataEntryIntakeReview";
import { DataEntryQueueRow } from "./DataEntryQueueRow";
import { DataEntrySummaryCards } from "./DataEntrySummaryCards";
import { AssignDataEntryDialog } from "./RmDialogs";

export interface DataEntrySearch {
  view?: "mine" | "team";
  filter?: DataEntryQueueFilter;
  q?: string;
  page?: number;
  caseId?: string;
  clarificationId?: string;
}

const FILTER_OPTIONS: ReadonlyArray<{
  value: DataEntryQueueFilter;
  label: string;
  countKey: string;
}> = [
  { value: "all", label: "All", countKey: "allInView" },
  { value: "to_review", label: "To review", countKey: "intakeToReview" },
  { value: "correction", label: "Waiting on correction", countKey: "correction" },
  { value: "l2_reentry", label: "L2 Re-entry", countKey: "l2Reentry" },
];

export function DataEntryWorkspace({
  search,
  onChange,
}: {
  search: DataEntrySearch;
  onChange: (patch: Partial<DataEntrySearch>, replace?: boolean) => void;
}) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const roles = session.data?.roles ?? [];
  const isLead = Boolean(
    session.data?.departments?.some((d) => d.kind === "DATA_ENTRY" && d.role === "LEAD"),
  );
  const isSupervisor = roles.some((r) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(r));
  const canSeeTeam = isLead || isSupervisor;
  const defaultTeam = isSupervisor && !roles.includes("DATA_ENTRY");
  const view: "mine" | "team" = canSeeTeam
    ? search.view === "team"
      ? "team"
      : search.view === "mine"
        ? "mine"
        : defaultTeam
          ? "team"
          : "mine"
    : "mine";
  const filter: DataEntryQueueFilter = search.filter ?? "all";
  const page = search.page ?? 1;
  const [input, setInput] = useState(search.q ?? "");
  const [reassign, setReassign] = useState<UnifiedQueueCase>();
  useEffect(() => setInput(search.q ?? ""), [search.q]);

  const queue = useQuery({
    queryKey: ["workflow", "data-entry", "unified", view, filter, search.q ?? "", page],
    queryFn: ({ signal }) =>
      getUnifiedDataEntryQueue({ view, filter, search: search.q, page, pageSize: 10 }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const overview = useQuery({
    queryKey: ["workflow", "data-entry", "overview", "mine"],
    queryFn: ({ signal }) => getDataEntryOverview("mine", signal),
    refetchInterval: 60_000,
    retry: false,
  });

  const pages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / 10));
  const kpis = overview.data?.kpis;
  const counts = queue.data?.counts ?? {};
  const hasActiveFilter = Boolean(search.q || filter !== "all");
  const openQueueItem = queue.data?.items.find(
    (item) =>
      item.id === search.caseId ||
      (search.clarificationId &&
        item.l2Reentries?.some((entry) => entry.id === search.clarificationId)),
  );

  return (
    <div className="rmo dei">
      <DataEntrySummaryCards
        counts={counts}
        overdueKpi={kpis?.overdue}
        readyTodayKpi={kpis?.readyToday}
      />
      <section className="rmo-card dei-queue" aria-label="Data Entry queue">
        <header className="dei-queue-head">
          <div>
            <h2>
              {view === "team" ? "Team cases" : "My cases"}
              <span className="dei-count">{queue.data?.total ?? 0}</span>
            </h2>
            <p>
              Open an intake case or L2 re-entry item to inspect documents, update details, and
              route forward.
            </p>
          </div>
          {canSeeTeam ? (
            <div className="ops-segment" role="group" aria-label="Queue">
              <button
                type="button"
                aria-pressed={view === "mine"}
                onClick={() =>
                  onChange({ view: defaultTeam ? "mine" : undefined, page: undefined })
                }
              >
                My work
              </button>
              <button
                type="button"
                aria-pressed={view === "team"}
                onClick={() => onChange({ view: "team", page: undefined })}
              >
                Team
              </button>
            </div>
          ) : null}
        </header>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Stage filter">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            const count = counts[opt.countKey];
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({
                    filter: opt.value === "all" ? undefined : opt.value,
                    page: undefined,
                  })
                }
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{opt.label}</span>
                {typeof count === "number" ? (
                  <span className={active ? "text-slate-300" : "text-slate-500"}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
        <form
          className="dei-search"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ q: input.trim() || undefined, page: undefined });
          }}
        >
          <Search aria-hidden />
          <input
            type="search"
            value={input}
            maxLength={120}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search candidate, Sapling ID or company"
            aria-label="Search intake"
          />
          <button type="submit" aria-label="Search">
            Search
          </button>
        </form>
        <div className="dei-status" role="status" aria-live="polite">
          {queue.isFetching ? "Updating…" : ""}
        </div>
        {queue.isError ? (
          <ErrorState
            description={queue.error.message}
            onRetry={() => void queue.refetch()}
            retrying={queue.isFetching}
          />
        ) : null}
        {queue.isPending ? <ListSkeleton rows={5} /> : null}
        {queue.data ? (
          queue.data.items.length ? (
            <ul className="dei-list" aria-label="Intake cases">
              {queue.data.items.map((item) => {
                const focused =
                  search.caseId === item.id ||
                  Boolean(
                    search.clarificationId &&
                    item.l2Reentries?.some((c) => c.id === search.clarificationId),
                  );
                return (
                  <DataEntryQueueRow
                    key={item.id}
                    item={item}
                    view={view}
                    focused={focused}
                    onOpen={(row) =>
                      onChange(
                        {
                          caseId: row.id,
                          clarificationId: row.l2Reentries?.[0]?.id,
                        },
                        true,
                      )
                    }
                    onReassign={setReassign}
                  />
                );
              })}
            </ul>
          ) : (
            <div className="dei-empty">
              <span className="dei-empty-icon">
                <CircleCheck aria-hidden />
              </span>
              <strong>{hasActiveFilter ? "No matching cases" : "All caught up"}</strong>
              <span>
                {hasActiveFilter
                  ? "Try clearing your search term or selecting All."
                  : "The RM or Operations assigns intake and L2 re-entry work here."}
              </span>
            </div>
          )
        ) : null}
        <footer className="rmo-pager">
          <span>
            {queue.data ? `${queue.data.total} case${queue.data.total === 1 ? "" : "s"}` : ""}
          </span>
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={page <= 1}
              onClick={() => onChange({ page: page - 1 })}
            >
              <ChevronLeft aria-hidden />
            </Button>
            <span className="rmo-page">
              Page {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={page >= pages}
              onClick={() => onChange({ page: page + 1 })}
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </footer>
      </section>
      <DataEntryIntakeReview
        caseId={search.caseId}
        clarificationId={search.clarificationId}
        queueItem={openQueueItem}
        onSelectClarification={(id) => onChange({ clarificationId: id }, true)}
        onClose={() => onChange({ caseId: undefined, clarificationId: undefined }, true)}
      />
      {reassign ? (
        <AssignDataEntryDialog item={reassign} onClose={() => setReassign(undefined)} />
      ) : null}
    </div>
  );
}
