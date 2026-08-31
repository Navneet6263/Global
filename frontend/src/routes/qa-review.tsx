import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { DeliveryShell } from "@/features/delivery/DeliveryShell";
import { QaQueue } from "@/features/delivery/qa/QaQueue";
import { QaReviewPanel } from "@/features/delivery/qa/QaReviewPanel";
import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getSession } from "@/lib/api/auth";
import { getQaQueue } from "@/lib/api/qa";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

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
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setCursorHistory([]);
      setSelectedId(undefined);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queue = useQuery({
    queryKey: ["qa", "queue", search, cursor],
    queryFn: () =>
      getQaQueue({
        limit: 25,
        ...(search ? { search } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  });
  const items = queue.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  const summary = queue.data?.summary ?? { awaiting: 0, overdue: 0, highRisk: 0, claimed: 0 };
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["qa", "queue"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return (
    <DeliveryShell
      workspace="qa-reviewer"
      onRefresh={() => void queue.refetch()}
      refreshing={queue.isFetching}
    >
      <WorkspaceIntro
        eyebrow="Delivery · Independent quality gate"
        title="Independent QA review"
        description="Review every source, finding and evidence item before a controlled approval or traceable rework decision."
        signal={`${summary.awaiting} awaiting review`}
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Awaiting review",
            value: summary.awaiting,
            detail: "Completed cases at the QA gate",
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
      {queue.isLoading ? <WorkspaceLoading label="Loading independent review queue" /> : null}
      {queue.isError ? (
        <WorkspaceError message={queue.error.message} onRetry={() => void queue.refetch()} />
      ) : null}
      {!queue.isLoading && !queue.isError ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.68fr)_minmax(0,1.32fr)]">
          <QaQueue
            items={items}
            selectedId={selected?.id}
            search={searchInput}
            page={cursorHistory.length + 1}
            hasPrevious={cursorHistory.length > 0}
            hasNext={Boolean(queue.data?.nextCursor)}
            onSearch={setSearchInput}
            onPrevious={() => {
              const history = [...cursorHistory];
              setCursor(history.pop());
              setCursorHistory(history);
              setSelectedId(undefined);
            }}
            onNext={() => {
              const next = queue.data?.nextCursor;
              if (!next) return;
              setCursorHistory((current) => [...current, cursor]);
              setCursor(next);
              setSelectedId(undefined);
            }}
            onSelect={setSelectedId}
          />
          {selected ? (
            <QaReviewPanel
              key={`${selected.id}-${selected.version}`}
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
