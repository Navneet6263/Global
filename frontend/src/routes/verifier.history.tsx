import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Gauge, History, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { VerifierTaskTable } from "@/features/delivery/verifier/VerifierTaskTable";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getMyTasks, getVerifierInsights } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier/history")({
  head: () => ({ meta: [{ title: "Completed Verification Checks — Sapling Global" }] }),
  component: VerifierHistoryPage,
});

function VerifierHistoryPage() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(input.trim());
      setCursor(undefined);
      setHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [input]);
  const insights = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    staleTime: 20_000,
  });
  const tasks = useQuery({
    queryKey: ["tasks", "mine", "COMPLETED", search, cursor],
    queryFn: () =>
      getMyTasks({ status: "COMPLETED", search, ...(cursor ? { cursor } : {}), limit: 25 }),
  });
  if (tasks.isLoading || insights.isLoading)
    return <WorkspaceLoading label="Loading completed verification history" />;
  if (tasks.isError || insights.isError)
    return (
      <WorkspaceError
        message={(tasks.error ?? insights.error)?.message ?? "History failed"}
        onRetry={() => void Promise.all([tasks.refetch(), insights.refetch()])}
      />
    );
  const summary = insights.data!.summary;
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="History · Controlled hand-offs"
        title="Completed checks"
        description="Search every completed assignment, reopen its evidence context and review the outcome sent to QA."
        signal={`${summary.totalCompleted} lifetime completions`}
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Controlled hand-offs today",
            icon: CheckCircle2,
            tone: "mint",
          },
          {
            label: "Completed this week",
            value: summary.completedThisWeek,
            detail: "Rolling seven-day output",
            icon: History,
            tone: "blue",
          },
          {
            label: "SLA hit rate",
            value: summary.slaHitRate === null ? "—" : `${summary.slaHitRate}%`,
            detail: "Within due time this week",
            icon: Gauge,
            tone:
              summary.slaHitRate === null ? "violet" : summary.slaHitRate >= 90 ? "mint" : "amber",
            share: summary.slaHitRate ?? undefined,
          },
          {
            label: "Average turnaround",
            value: duration(summary.averageTurnaroundMinutes),
            detail: "Start to completion this week",
            icon: History,
            tone: "violet",
          },
        ]}
      />
      <label className="relative block max-w-md">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search candidate, case or client"
          className="h-11 w-full rounded-full border border-white/80 bg-card/85 pl-11 pr-4 text-[11px] shadow-[var(--shadow-card)] outline-none focus:border-mint/40 focus:ring-2 focus:ring-mint/10"
        />
      </label>
      <VerifierTaskTable
        title="Outcome history"
        detail={search ? `Results matching “${search}”` : "Most recent completed checks first"}
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

function duration(minutes: number) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
