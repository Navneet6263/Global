import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, BadgeCheck, Gauge, TimerReset } from "lucide-react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getVerifierInsights } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier/performance")({
  head: () => ({ meta: [{ title: "Verifier Performance — Sapling Global" }] }),
  component: VerifierPerformancePage,
});

function VerifierPerformancePage() {
  const query = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    staleTime: 20_000,
  });
  if (query.isLoading) return <WorkspaceLoading label="Calculating verifier performance" />;
  if (query.isError)
    return <WorkspaceError message={query.error.message} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  const { summary, outcomes, daily } = query.data;
  const peak = Math.max(1, ...daily.map((item) => item.completed));
  const outcomeTotal = outcomes.clear + outcomes.discrepancy + outcomes.unableToVerify;
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Insights · Personal delivery"
        title="My performance"
        description="Transparent throughput, SLA discipline and recorded outcome mix from your own completed assignments."
        signal="Live database metrics"
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Seven-day output",
            value: summary.completedThisWeek,
            detail: "Checks completed in the rolling week",
            icon: Activity,
            tone: "blue",
          },
          {
            label: "SLA hit rate",
            value: summary.slaHitRate === null ? "—" : `${summary.slaHitRate}%`,
            detail: "Completed within assigned due time",
            icon: Gauge,
            tone:
              summary.slaHitRate === null ? "violet" : summary.slaHitRate >= 90 ? "mint" : "amber",
            share: summary.slaHitRate ?? undefined,
          },
          {
            label: "Average turnaround",
            value: duration(summary.averageTurnaroundMinutes),
            detail: "From start to controlled completion",
            icon: TimerReset,
            tone: "violet",
          },
          {
            label: "Lifetime completed",
            value: summary.totalCompleted,
            detail: "All checks handed forward",
            icon: BadgeCheck,
            tone: "mint",
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-[1.7rem] border border-white/85 bg-card/90 p-5 shadow-[var(--shadow-float)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold">Throughput rhythm</h2>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Completed checks across the last seven calendar days
              </p>
            </div>
            <span className="rounded-full bg-info-soft px-3 py-1.5 text-[9.5px] font-semibold text-info-foreground">
              7-day view
            </span>
          </div>
          <div className="mt-7 grid h-56 grid-cols-7 items-end gap-3 border-b border-border/60 px-2">
            {daily.map((day) => (
              <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="num text-[10px] font-semibold">{day.completed}</span>
                <div className="flex h-[155px] w-full max-w-12 items-end overflow-hidden rounded-t-full bg-info-soft/55">
                  <span
                    className="w-full rounded-t-full bg-gradient-to-t from-info to-mint transition-[height] duration-500"
                    style={{
                      height: `${Math.max(day.completed ? 12 : 3, (day.completed / peak) * 100)}%`,
                    }}
                  />
                </div>
                <span className="pb-2 text-[9px] text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
                    new Date(day.date),
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-[1.7rem] border border-white/85 bg-card/90 p-5 shadow-[var(--shadow-float)] sm:p-6">
          <h2 className="text-[15px] font-semibold">Outcome mix</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Defensible results recorded this week
          </p>
          <div
            className="mt-6 flex h-4 overflow-hidden rounded-full bg-muted"
            aria-label="Weekly verification outcomes"
          >
            <OutcomeSegment value={outcomes.clear} total={outcomeTotal} className="bg-success" />
            <OutcomeSegment
              value={outcomes.discrepancy}
              total={outcomeTotal}
              className="bg-warning"
            />
            <OutcomeSegment
              value={outcomes.unableToVerify}
              total={outcomeTotal}
              className="bg-critical"
            />
          </div>
          <div className="mt-5 space-y-3">
            <OutcomeRow
              label="Clear"
              value={outcomes.clear}
              total={outcomeTotal}
              color="bg-success"
            />
            <OutcomeRow
              label="Discrepancy"
              value={outcomes.discrepancy}
              total={outcomeTotal}
              color="bg-warning"
            />
            <OutcomeRow
              label="Unable to verify"
              value={outcomes.unableToVerify}
              total={outcomeTotal}
              color="bg-critical"
            />
          </div>
          <div className="mt-6 rounded-[1.2rem] border border-mint/15 bg-mint-soft/35 p-4">
            <p className="text-[10.5px] font-semibold">Quality interpretation</p>
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">
              This view measures process discipline, not a target for clear outcomes. Discrepancies
              and unable-to-verify decisions are valid when the recorded evidence supports them.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function OutcomeSegment({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className: string;
}) {
  return <span className={className} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />;
}

function OutcomeRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1rem] border border-border/60 bg-background/50 p-3">
      <span className={`size-2.5 rounded-full ${color}`} />
      <span className="flex-1 text-[10.5px] font-medium">{label}</span>
      <span className="num text-[11px] font-semibold">{value}</span>
      <span className="w-10 text-right text-[9px] text-muted-foreground">
        {total ? Math.round((value / total) * 100) : 0}%
      </span>
    </div>
  );
}

function duration(minutes: number) {
  if (!minutes) return "—";
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
