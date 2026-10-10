import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DeliveryShell } from "@/features/delivery/DeliveryShell";
import { QaQueue } from "@/features/delivery/qa/QaQueue";
import { QaSelectedCase } from "@/features/delivery/qa/QaSelectedCase";
import { QaDashboard } from "./QaDashboard";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { QaHistory } from "@/features/delivery/qa/QaHistory";
import { WorkspaceIntro } from "@/features/delivery/shared/WorkspaceIntro";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getSession } from "@/lib/api/auth";
import { getQaRegister, type QaRegisterView } from "@/lib/backend-api/qa-register";
import { ExportSheetButton } from "@/components/workspace/export-sheet";
import { QA_REGISTER_COLUMNS, QA_REGISTER_DEFAULTS, loadQaRegister } from "./qa-export";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";

export type QaPageView = "overview" | "all" | "mine" | "corrections" | "history";
const titles: Record<QaPageView, [string, string]> = {
  overview: ["QA overview", "Queue health, SLA and your review trend at a glance."],
  all: ["Review queue", "Claim an available case, inspect the evidence and record your decision."],
  mine: ["My reviews", "Continue the cases currently reserved for your independent review."],
  corrections: [
    "Corrections",
    "Track returned cases while verification teams resolve your findings.",
  ],
  history: [
    "Decision history",
    "Your recorded decisions, with the current case and report status.",
  ],
};

export function QaWorkspace({
  view = "all",
  initialCaseId,
}: {
  view?: QaPageView;
  /** Case to open first, e.g. from the dashboard's Up next list. */
  initialCaseId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | undefined>(initialCaseId);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [availableOnly, setAvailableOnly] = useState(false);
  const queryView =
    view === "all" && availableOnly
      ? "available"
      : view === "history" || view === "overview"
        ? "all"
        : view;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queue = useQuery({
    queryKey: ["qa", "register", search, page, queryView],
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      getQaRegister(
        {
          limit: 25,
          page,
          view: queryView,
          ...(search ? { search } : {}),
        },
        signal,
      ),
    enabled: view !== "history" && search === searchInput.trim(),
  });
  const pending = queue.isLoading || queue.isPlaceholderData || search !== searchInput.trim();
  const items = queue.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  useEffect(() => {
    if (!pending && selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [pending, selected, selectedId]);
  const summary = queue.data?.summary ?? { awaiting: 0, overdue: 0, highRisk: 0, claimed: 0 };
  const refresh = async () => {
    await invalidateWorkflow(queryClient);
  };
  return (
    <DeliveryShell
      workspace="qa-reviewer"
      onRefresh={() => void refresh()}
      refreshing={queue.isFetching}
    >
      <WorkspaceIntro
        eyebrow="Delivery · Independent quality gate"
        title={titles[view][0]}
        description={titles[view][1]}
        signal={
          view === "history"
            ? "Your saved decisions"
            : queue.isError
              ? "Queue unavailable"
              : !queue.data
                ? "Loading queue"
                : `${summary.awaiting} awaiting review`
        }
        actions={
          view === "overview" ? (
            <Link
              to="/qa-review"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Start reviewing <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : view === "all" || view === "mine" || view === "corrections" ? (
            <ExportSheetButton
              source={view === "all" ? "qa-queue" : view === "mine" ? "qa-mine" : "qa-corrections"}
              title={`Export ${titles[view][0].toLowerCase()}`}
              filename={`Sapling-Global-qa-${view === "all" ? "queue" : view}`}
              columns={QA_REGISTER_COLUMNS}
              defaults={QA_REGISTER_DEFAULTS}
              scopeNote={`${titles[view][0]}${search ? ` · search “${search}”` : ""}`}
              loadRows={() => loadQaRegister(queryView as QaRegisterView, search || undefined)}
            />
          ) : null
        }
      />
      {view === "overview" ? <QaDashboard /> : null}
      {view === "history" ? <QaHistory /> : null}
      {view !== "history" && queue.isError ? (
        <WorkspaceError message={queue.error.message} onRetry={() => void queue.refetch()} />
      ) : null}
      {view !== "history" && view !== "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[19rem_minmax(0,1fr)] 2xl:grid-cols-[21rem_minmax(0,1fr)]">
          <QaQueue
            items={items}
            pending={pending}
            unavailable={queue.isError}
            availableOnly={view === "all" ? availableOnly : undefined}
            onAvailableChange={(value) => {
              setAvailableOnly(value);
              setPage(1);
            }}
            corrections={view === "corrections"}
            total={queue.data?.total ?? 0}
            selectedId={selected?.id}
            search={searchInput}
            page={page}
            hasPrevious={page > 1 && !queue.isFetching && !pending}
            hasNext={page * 25 < (queue.data?.total ?? 0) && !queue.isFetching && !pending}
            onSearch={setSearchInput}
            onPrevious={() => {
              setPage((current) => Math.max(1, current - 1));
            }}
            onNext={() => {
              setPage((current) => current + 1);
            }}
            onSelect={setSelectedId}
          />
          <div
            className="min-w-0 min-h-[28rem]"
            inert={pending || queue.isError}
            aria-busy={pending}
          >
            {selected && !queue.isError ? (
              <QaSelectedCase
                key={selected.id}
                item={selected}
                reviewerId={session.data?.id}
                onRefresh={refresh}
              />
            ) : pending ? (
              <WorkspaceLoading label="Loading review cases" />
            ) : queue.isError ? null : (
              <WorkspaceEmpty
                title="Review queue is clear"
                detail="No cases are waiting at the independent QA gate."
              />
            )}
          </div>
        </div>
      ) : null}
    </DeliveryShell>
  );
}
