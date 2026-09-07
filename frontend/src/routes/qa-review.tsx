import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { DeliveryShell } from "@/features/delivery/DeliveryShell";
import { QaQueue } from "@/features/delivery/qa/QaQueue";
import { QaSelectedCase } from "@/features/delivery/qa/QaSelectedCase";
import { QaViews, type QaWorkView } from "@/features/delivery/qa/QaViews";
import { QaHistory } from "@/features/delivery/qa/QaHistory";
import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getSession } from "@/lib/api/auth";
import { getQaRegister } from "@/lib/backend-api/qa-register";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";

export const Route = createFileRoute("/qa-review")({
  head: () => ({ meta: [{ title: "QA Review — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["QA_REVIEWER"]),
  component: QaWorkspace,
});

function QaWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<QaWorkView>("all");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setSelectedId(undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queue = useQuery({
    queryKey: ["qa", "register", search, page, view],
    queryFn: ({ signal }) =>
      getQaRegister(
        {
          limit: 25,
          page,
          view: view === "history" ? "all" : view,
          ...(search ? { search } : {}),
        },
        signal,
      ),
    enabled: view !== "history" && search === searchInput.trim(),
  });
  const items = queue.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
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
        title="Independent QA review"
        description="Review every source, finding and evidence item before a controlled approval or traceable rework decision."
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
      {view !== "history" && queue.data && !queue.isError ? (
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
      <QaViews
        value={view}
        onChange={(next) => {
          setView(next);
          setPage(1);
          setSelectedId(undefined);
        }}
      />
      {view === "history" ? <QaHistory /> : null}
      {view !== "history" && queue.isLoading ? (
        <WorkspaceLoading label="Loading independent review queue" />
      ) : null}
      {view !== "history" && queue.isError ? (
        <WorkspaceError message={queue.error.message} onRetry={() => void queue.refetch()} />
      ) : null}
      {view !== "history" && !queue.isLoading && !queue.isError ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.68fr)_minmax(0,1.32fr)]">
          <QaQueue
            items={items}
            corrections={view === "corrections"}
            total={queue.data?.total ?? 0}
            selectedId={selected?.id}
            search={searchInput}
            page={page}
            hasPrevious={page > 1 && !queue.isFetching}
            hasNext={page * 25 < (queue.data?.total ?? 0) && !queue.isFetching}
            onSearch={setSearchInput}
            onPrevious={() => {
              setPage((current) => Math.max(1, current - 1));
              setSelectedId(undefined);
            }}
            onNext={() => {
              setPage((current) => current + 1);
              setSelectedId(undefined);
            }}
            onSelect={setSelectedId}
          />
          {selected ? (
            <QaSelectedCase
              key={selected.id}
              item={selected}
              reviewerId={session.data?.id}
              onRefresh={refresh}
            />
          ) : (
            <WorkspaceEmpty
              title="Review queue is clear"
              detail="No cases are waiting at the independent QA gate."
            />
          )}
        </div>
      ) : null}
    </DeliveryShell>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
