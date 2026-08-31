import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import { DeliveryShell } from "@/features/delivery/DeliveryShell";
import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { VerifierQueue } from "@/features/delivery/verifier/VerifierQueue";
import { VerifierTaskWorkspace } from "@/features/delivery/verifier/VerifierTaskWorkspace";
import {
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceLoading,
} from "@/features/delivery/WorkspaceStates";
import { getMyTasks } from "@/lib/api/tasks";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/verifier")({
  head: () => ({ meta: [{ title: "Verifier Workbench — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["VERIFIER"]),
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
    <DeliveryShell
      workspace="verifier"
      onRefresh={() => void tasks.refetch()}
      refreshing={tasks.isFetching}
    >
      <WorkspaceIntro
        eyebrow="Delivery · Verifier desk"
        title="Verification workbench"
        description="A focused execution desk for source checks, evidence-backed findings and controlled hand-off to quality review."
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
            tone: "red",
            share: ratio(summary.overdue, summary.active),
          },
          {
            label: "Blocked",
            value: summary.blocked,
            detail: "Waiting on a source or dependency",
            icon: Ban,
            tone: "amber",
            share: ratio(summary.blocked, summary.active),
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Sent to the next workflow stage",
            icon: CheckCircle2,
            tone: "mint",
            share: ratio(summary.completedToday, summary.active + summary.completedToday),
          },
        ]}
      />
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
