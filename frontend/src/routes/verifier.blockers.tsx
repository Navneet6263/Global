import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CircleCheck, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { VerifierTaskTable } from "@/features/delivery/verifier/VerifierTaskTable";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getMyTasks, getVerifierInsights } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier/blockers")({
  head: () => ({ meta: [{ title: "Verifier Blockers — Sapling Global" }] }),
  component: VerifierBlockersPage,
});

function VerifierBlockersPage() {
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const insights = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    staleTime: 20_000,
  });
  const tasks = useQuery({
    queryKey: ["tasks", "mine", "BLOCKED", cursor],
    queryFn: () => getMyTasks({ status: "BLOCKED", ...(cursor ? { cursor } : {}), limit: 20 }),
  });
  if (tasks.isLoading || insights.isLoading)
    return <WorkspaceLoading label="Loading blocker recovery desk" />;
  if (tasks.isError || insights.isError)
    return (
      <WorkspaceError
        message={(tasks.error ?? insights.error)?.message ?? "Blocker desk failed"}
        onRetry={() => void Promise.all([tasks.refetch(), insights.refetch()])}
      />
    );
  const summary = insights.data!.summary;
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Work · Dependency recovery"
        title="Blockers & clarifications"
        description="Keep every waiting dependency factual, visible and tied to the assigned verification check."
        signal={summary.blocked ? `${summary.blocked} need recovery` : "No blocked work"}
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Blocked checks",
            value: summary.blocked,
            detail: "Waiting on evidence or source",
            icon: Ban,
            tone: summary.blocked ? "red" : "mint",
          },
          {
            label: "Overdue exposure",
            value: summary.overdue,
            detail: "All active tasks beyond SLA",
            icon: ShieldAlert,
            tone: summary.overdue ? "red" : "mint",
            share: ratio(summary.overdue, summary.active),
          },
          {
            label: "Open workload",
            value: summary.open,
            detail: "Can be started immediately",
            icon: MessageSquareWarning,
            tone: "amber",
            share: ratio(summary.open, summary.active),
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail: "Dependencies cleared and handed off",
            icon: CircleCheck,
            tone: "mint",
          },
        ]}
      />
      <RecoveryGuide />
      <VerifierTaskTable
        title="Blocked assignments"
        detail="Open a task to review context, raise a clarification or resume verified work"
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

function RecoveryGuide() {
  const steps = [
    [
      "1",
      "Confirm dependency",
      "Use a factual blocker reason—source, evidence or candidate input.",
    ],
    ["2", "Raise clarification", "Ask only for the exact information required to continue."],
    [
      "3",
      "Resume with evidence",
      "Resume after the response is reviewed; the audit trail remains intact.",
    ],
  ];
  return (
    <section className="grid gap-3 rounded-[1.55rem] border border-warning/20 bg-gradient-to-r from-warning-soft/55 via-card/90 to-mint-soft/45 p-4 shadow-[var(--shadow-card)] md:grid-cols-3">
      {steps.map(([number, title, detail]) => (
        <article
          key={number}
          className="flex gap-3 rounded-[1.1rem] border border-white/80 bg-white/65 p-3.5"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning text-[10px] font-bold text-warning-foreground">
            {number}
          </span>
          <div>
            <p className="text-[11px] font-semibold">{title}</p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground">{detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
