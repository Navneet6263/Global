import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { DeliveryHeader, DeliveryKpis, DeliveryShell } from "@/features/delivery/DeliveryShell";
import { humanize } from "@/features/delivery/utils";
import { VerifierQueue } from "@/features/delivery/verifier/VerifierQueue";
import { VerifierTaskWorkspace } from "@/features/delivery/verifier/VerifierTaskWorkspace";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getMyTasks } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier")({
  head: () => ({ meta: [{ title: "Verifier Workbench — Sapling Global" }] }),
  component: VerifierWorkbench,
});

const filters = ["ACTIVE", "OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED"] as const;

function VerifierWorkbench() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>("ACTIVE");
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
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const queryStatus = filter === "ACTIVE" ? undefined : filter;
  const tasks = useQuery({
    queryKey: ["tasks", "mine", queryStatus, search, cursor],
    queryFn: () =>
      getMyTasks({
        search,
        limit: 25,
        ...(queryStatus ? { status: queryStatus } : {}),
        ...(filter === "ACTIVE" ? { view: "ACTIVE" as const } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  });
  const items = tasks.data?.items ?? [];
  const selected = items.find((task) => task.id === selectedId) ?? items[0];
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);
  const summary = tasks.data?.summary ?? { active: 0, overdue: 0, blocked: 0, completedToday: 0 };
  return (
    <DeliveryShell onRefresh={() => void tasks.refetch()} refreshing={tasks.isFetching}>
      <DeliveryHeader
        eyebrow="Delivery / Verifier"
        title="Verification workbench"
        description="Prioritised checks, defensible source records and structured findings in one focused workspace."
        aside={
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {summary.active} active checks
          </span>
        }
      />
      <DeliveryKpis
        items={[
          {
            label: "Active workload",
            value: summary.active,
            detail: "Open, assigned and in progress",
            icon: ClipboardCheck,
            tone: "blue",
            progress: summary.active ? 100 : 0,
          },
          {
            label: "SLA overdue",
            value: summary.overdue,
            detail: "Past committed task due time",
            icon: Clock3,
            tone: "red",
            progress: ratio(summary.overdue, summary.active),
          },
          {
            label: "Blocked",
            value: summary.blocked,
            detail: "Waiting on a source or dependency",
            icon: Ban,
            tone: "amber",
            progress: ratio(summary.blocked, summary.active),
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Sent to the next workflow stage",
            icon: CheckCircle2,
            tone: "emerald",
            progress: ratio(summary.completedToday, summary.active + summary.completedToday),
          },
        ]}
      />
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {filters.map((value) => (
          <button
            key={value}
            onClick={() => {
              setFilter(value);
              setSelectedId(undefined);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${filter === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {humanize(value)}
          </button>
        ))}
      </div>
      {tasks.isLoading ? <WorkspaceLoading label="Loading assigned checks" /> : null}
      {tasks.isError ? (
        <WorkspaceError message={tasks.error.message} onRetry={() => void tasks.refetch()} />
      ) : null}
      {!tasks.isLoading && !tasks.isError ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
          <VerifierQueue
            items={items}
            selectedId={selected?.id}
            search={searchInput}
            hasPrevious={cursorHistory.length > 0}
            hasNext={Boolean(tasks.data?.nextCursor)}
            onSearch={setSearchInput}
            onPrevious={() => {
              const history = [...cursorHistory];
              setCursor(history.pop());
              setCursorHistory(history);
              setSelectedId(undefined);
            }}
            onNext={() => {
              const nextCursor = tasks.data?.nextCursor;
              if (!nextCursor) return;
              setCursorHistory((current) => [...current, cursor]);
              setCursor(nextCursor);
              setSelectedId(undefined);
            }}
            onSelect={setSelectedId}
          />
          {selected ? (
            <VerifierTaskWorkspace
              key={`${selected.id}-${selected.version}`}
              task={selected}
              onUpdated={async () => {
                await queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] });
              }}
            />
          ) : (
            <WorkspaceEmpty
              title="Queue is clear"
              detail="No tasks match the selected delivery view."
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
