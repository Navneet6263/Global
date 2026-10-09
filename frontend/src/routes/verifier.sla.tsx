import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock, CircleAlert, Clock3, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { VerifierTaskTable } from "@/features/delivery/verifier/VerifierTaskTable";
import { ExportSheetButton } from "@/components/workspace/export-sheet";
import {
  TASK_EXPORT_COLUMNS,
  TASK_EXPORT_DEFAULTS,
  loadAllTasks,
} from "@/features/delivery/verifier/task-export";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getMyTasks, getVerifierInsights } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";

const views = [
  { id: "ALL", label: "All active" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "DUE_TODAY", label: "Due today" },
  { id: "DUE_SOON", label: "Next 24 hours" },
] as const;
type View = (typeof views)[number]["id"];

export const Route = createFileRoute("/verifier/sla")({
  head: () => ({ meta: [{ title: "Verifier SLA & Priorities — Sapling Global" }] }),
  component: VerifierSlaPage,
});

function VerifierSlaPage() {
  const [view, setView] = useState<View>("ALL");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const insights = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    staleTime: 20_000,
  });
  const tasks = useQuery({
    queryKey: ["tasks", "mine", "sla", view, cursor],
    queryFn: () =>
      getMyTasks({
        view: "ACTIVE",
        ...(view !== "ALL" ? { sla: view } : {}),
        ...(cursor ? { cursor } : {}),
        limit: 25,
      }),
  });
  if (tasks.isLoading || insights.isLoading)
    return <WorkspaceLoading label="Calculating SLA priorities" />;
  if (tasks.isError || insights.isError)
    return (
      <WorkspaceError
        message={(tasks.error ?? insights.error)?.message ?? "SLA desk failed"}
        onRetry={() => void Promise.all([tasks.refetch(), insights.refetch()])}
      />
    );
  const summary = insights.data!.summary;
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Work · Time commitments"
        title="SLA & priorities"
        description="A deadline-first queue that separates immediate recovery from healthy scheduled work."
        signal={
          summary.slaHitRate === null
            ? "No weekly completion sample"
            : `${summary.slaHitRate}% weekly SLA hit rate`
        }
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Overdue",
            value: summary.overdue,
            detail: "Needs immediate recovery",
            icon: CircleAlert,
            tone: summary.overdue ? "red" : "mint",
            share: ratio(summary.overdue, summary.active),
          },
          {
            label: "Due today",
            value: summary.dueToday,
            detail: "Committed before day close",
            icon: CalendarClock,
            tone: "amber",
            share: ratio(summary.dueToday, summary.active),
          },
          {
            label: "Next 24 hours",
            value: summary.dueNext24h,
            detail: "Near-term workload",
            icon: Clock3,
            tone: "blue",
            share: ratio(summary.dueNext24h, summary.active),
          },
          {
            label: "SLA hit rate",
            value: summary.slaHitRate === null ? "—" : `${summary.slaHitRate}%`,
            detail: "Completed within commitment this week",
            icon: ShieldCheck,
            tone:
              summary.slaHitRate === null ? "violet" : summary.slaHitRate >= 90 ? "mint" : "amber",
            share: summary.slaHitRate ?? undefined,
          },
        ]}
      />
      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-white p-1.5 shadow-sm">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setView(item.id);
              setCursor(undefined);
              setHistory([]);
            }}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[12.5px] font-semibold transition",
              view === item.id
                ? "bg-blue-600 text-white"
                : "text-muted-foreground hover:bg-blue-50 hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <VerifierTaskTable
        exporter={
          <ExportSheetButton
            source="verifier-sla"
            title="Export SLA list"
            filename="Sapling-Global-verifier-sla"
            columns={TASK_EXPORT_COLUMNS}
            defaults={TASK_EXPORT_DEFAULTS}
            scopeNote={views.find((item) => item.id === view)!.label}
            loadRows={() =>
              loadAllTasks({ view: "ACTIVE", ...(view !== "ALL" ? { sla: view } : {}) })
            }
          />
        }
        title={views.find((item) => item.id === view)!.label}
        detail="Sorted by nearest committed due time"
        items={tasks.data?.items ?? []}
        hasPrevious={history.length > 0}
        hasNext={Boolean(tasks.data?.nextCursor)}
        onPrevious={() => {
          const next = [...history];
          setCursor(next.pop());
          setHistory(next);
        }}
        onNext={() => {
          const next = tasks.data?.nextCursor;
          if (!next) return;
          setHistory((current) => [...current, cursor]);
          setCursor(next);
        }}
      />
    </div>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
