import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { DeliveryShell } from "@/features/delivery/DeliveryShell";
import { QaQueue } from "@/features/delivery/qa/QaQueue";
import { QaSelectedCase } from "@/features/delivery/qa/QaSelectedCase";
import { QaOverview } from "./QaOverview";
import { QaHistory } from "@/features/delivery/qa/QaHistory";
import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getSession } from "@/lib/api/auth";
import { getQaRegister } from "@/lib/backend-api/qa-register";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";

export type QaPageView = "overview" | "all" | "mine" | "corrections" | "history";
const titles: Record<QaPageView, [string, string]> = {
  overview: ["QA overview", "See the quality queue, identify risk and choose your next review."],
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

export function QaWorkspace({ view = "all" }: { view?: QaPageView }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
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
      />
      {view === "overview" && queue.data && !queue.isError ? (
        <WorkspaceMetricGrid
          items={[
            {
              label: "Awaiting review",
              value: summary.awaiting,
              detail: "Cases with completed checks at QA",
              icon: ShieldCheck,
              tone: "mint",
            },
            {
              label: "SLA overdue",
              value: summary.overdue,
              detail: "Review queue beyond due time",
              icon: Clock3,
              tone: "red",
              share: ratio(summary.overdue, summary.awaiting),
            },
            {
              label: "High risk",
              value: summary.highRisk,
              detail: "Cases with high or critical findings",
              icon: AlertTriangle,
              tone: "amber",
              share: ratio(summary.highRisk, summary.awaiting),
            },
            {
              label: "Claimed",
              value: summary.claimed,
              detail: "Protected from duplicate review",
              icon: LockKeyhole,
              tone: "violet",
              share: ratio(summary.claimed, summary.awaiting),
            },
          ]}
        />
      ) : null}
      {view === "overview" ? <QaOverview /> : null}
      {view === "history" ? <QaHistory /> : null}
      {view === "overview" && queue.isLoading ? (
        <WorkspaceLoading label="Loading independent review queue" />
      ) : null}
      {view !== "history" && queue.isError ? (
        <WorkspaceError message={queue.error.message} onRetry={() => void queue.refetch()} />
      ) : null}
      {view !== "history" && view !== "overview" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.68fr)_minmax(0,1.32fr)]">
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

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
