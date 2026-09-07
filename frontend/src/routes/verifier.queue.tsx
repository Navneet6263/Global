import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Ban, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import {
  VerifierQueue,
  type VerifierQueueFilter,
} from "@/features/delivery/verifier/VerifierQueue";
import { VerifierTaskDesk } from "@/features/delivery/verifier/VerifierTaskDesk";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getMyTasks } from "@/lib/api/tasks";

const filters: readonly VerifierQueueFilter[] = [
  "ACTIVE",
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
];

export const Route = createFileRoute("/verifier/queue")({
  head: () => ({ meta: [{ title: "Active Verification Queue — Sapling Global" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    taskId: typeof search["taskId"] === "string" ? search["taskId"] : undefined,
    status: filters.includes(search["status"] as VerifierQueueFilter)
      ? (search["status"] as VerifierQueueFilter)
      : undefined,
  }),
  component: VerifierWorkbench,
});

function VerifierWorkbench() {
  const deepLink = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VerifierQueueFilter>(deepLink.status ?? "ACTIVE");
  const [selectedId, setSelectedId] = useState<string | undefined>(deepLink.taskId);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  useEffect(() => {
    setSelectedId(deepLink.taskId);
    if (deepLink.status) setFilter(deepLink.status);
  }, [deepLink.status, deepLink.taskId]);
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
    queryKey: ["tasks", "mine", queryStatus, search, cursor, deepLink.taskId],
    queryFn: () =>
      getMyTasks({
        search,
        limit: 25,
        ...(deepLink.taskId ? { taskId: deepLink.taskId } : {}),
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
  const clearDeepLink = () =>
    void navigate({ search: { taskId: undefined, status: undefined }, replace: true });
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Work · Assigned checks"
        title="Active verification queue"
        description="Review protected evidence, record defensible findings and move each assigned check through a controlled hand-off."
        signal={`${summary.active} active checks`}
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Active workload",
            value: summary.active,
            detail: "Open, assigned and in progress",
            icon: ClipboardCheck,
            tone: "mint",
          },
          {
            label: "SLA overdue",
            value: summary.overdue,
            detail: "Past committed task due time",
            icon: Clock3,
            tone: summary.overdue ? "red" : "mint",
            share: ratio(summary.overdue, summary.active),
          },
          {
            label: "Blocked",
            value: summary.blocked,
            detail: "Waiting on source or dependency",
            icon: Ban,
            tone: summary.blocked ? "amber" : "mint",
            share: ratio(summary.blocked, summary.active),
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Sent forward with an audit trail",
            icon: CheckCircle2,
            tone: "blue",
          },
        ]}
      />
      {deepLink.taskId ? (
        <button
          type="button"
          onClick={clearDeepLink}
          className="rounded-full border border-border bg-white/75 px-3.5 py-2 text-[10.5px] font-semibold text-mint-deep shadow-[var(--shadow-card)] hover:bg-mint-soft"
        >
          ← Return to full queue
        </button>
      ) : null}
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
            filters={filters}
            activeFilter={filter}
            hasPrevious={cursorHistory.length > 0}
            hasNext={Boolean(tasks.data?.nextCursor)}
            onSearch={setSearchInput}
            onFilter={(value) => {
              setFilter(value);
              setSelectedId(undefined);
              setCursor(undefined);
              setCursorHistory([]);
              if (deepLink.taskId || deepLink.status) clearDeepLink();
            }}
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
            <VerifierTaskDesk
              task={selected}
              onUpdated={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
                  queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
                  queryClient.invalidateQueries({ queryKey: ["tasks", selected.id, "context"] }),
                ]);
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
    </div>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
