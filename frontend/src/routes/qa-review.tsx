import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DeliveryHeader, DeliveryKpis, DeliveryShell } from "@/features/delivery/DeliveryShell";
import { QaQueue } from "@/features/delivery/qa/QaQueue";
import { QaReviewPanel } from "@/features/delivery/qa/QaReviewPanel";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getSession } from "@/lib/api/auth";
import { getQaQueue } from "@/lib/api/qa";

export const Route = createFileRoute("/qa-review")({
  head: () => ({ meta: [{ title: "QA Review — Sapling Global" }] }),
  component: QaWorkspace,
});

function QaWorkspace() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState("");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const queue = useQuery({ queryKey: ["qa", "queue"], queryFn: getQaQueue });
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queue.data?.items ?? [];
    return (queue.data?.items ?? []).filter((item) =>
      `${item.subject.fullName} ${item.caseNumber} ${item.client.displayName}`
        .toLowerCase()
        .includes(term),
    );
  }, [queue.data?.items, search]);
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
    <DeliveryShell onRefresh={() => void queue.refetch()} refreshing={queue.isFetching}>
      <DeliveryHeader
        eyebrow="Delivery / Quality"
        title="Independent QA review"
        description="Evidence-led review, controlled decisions and clear rework ownership before any report is released."
        aside={
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Segregated quality gate
          </span>
        }
      />
      <DeliveryKpis
        items={[
          {
            label: "Awaiting review",
            value: summary.awaiting,
            detail: "Completed cases at the QA gate",
            icon: ShieldCheck,
            tone: "blue",
            progress: summary.awaiting ? 100 : 0,
          },
          {
            label: "SLA overdue",
            value: summary.overdue,
            detail: "Review queue beyond due time",
            icon: Clock3,
            tone: "red",
            progress: ratio(summary.overdue, summary.awaiting),
          },
          {
            label: "High risk",
            value: summary.highRisk,
            detail: "Cases with high or critical findings",
            icon: AlertTriangle,
            tone: "amber",
            progress: ratio(summary.highRisk, summary.awaiting),
          },
          {
            label: "Claimed",
            value: summary.claimed,
            detail: "Protected from duplicate review",
            icon: LockKeyhole,
            tone: "violet",
            progress: ratio(summary.claimed, summary.awaiting),
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
            search={search}
            onSearch={setSearch}
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
