import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, CircleAlert, Clock3, Layers3 } from "lucide-react";

import type { VerificationTask, VerifierInsights } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { formatDate, humanize } from "../utils";

export function VerifierOverviewPanels({
  insights,
  focus,
}: {
  insights: VerifierInsights;
  focus: VerificationTask[];
}) {
  const peak = Math.max(1, ...insights.daily.map((day) => day.completed));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]">
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-blue-500 to-warning" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
              Execution pulse
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Today’s verification desk
            </h2>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Work the highest-risk due item first, then clear waiting dependencies.
            </p>
          </div>
          <Link
            to="/verifier/queue"
            search={{ taskId: undefined, status: undefined }}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:brightness-110"
          >
            Open workbench <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PulseCard
            icon={Layers3}
            label="Ready to start"
            value={insights.summary.open}
            tone="mint"
          />
          <PulseCard
            icon={Clock3}
            label="In progress"
            value={insights.summary.inProgress}
            tone="blue"
          />
          <PulseCard
            icon={CircleAlert}
            label="Needs recovery"
            value={insights.summary.blocked + insights.summary.overdue}
            tone="amber"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold">Seven-day throughput</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Checks completed by day</p>
            </div>
            <span className="num rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
              {insights.summary.completedThisWeek} total
            </span>
          </div>
          <div
            className="mt-5 grid h-32 grid-cols-7 items-end gap-2"
            aria-label="Completed checks by day"
          >
            {insights.daily.map((day) => (
              <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2">
                <span className="num text-[11px] font-semibold text-muted-foreground">
                  {day.completed}
                </span>
                <div className="flex h-[82px] w-full max-w-9 items-end overflow-hidden rounded-full bg-white">
                  <span
                    className="w-full rounded-full bg-gradient-to-t from-blue-600 to-blue-500 transition-[height] duration-500"
                    style={{
                      height: `${Math.max(day.completed ? 16 : 4, (day.completed / peak) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(
                    new Date(day.date),
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Priority focus</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Nearest SLA commitments in your queue
            </p>
          </div>
          <Link
            to="/verifier/sla"
            className="text-[12.5px] font-semibold text-blue-700 hover:underline"
          >
            View SLA desk
          </Link>
        </div>
        <div className="mt-4 space-y-2.5">
          {focus.slice(0, 5).map((task) => (
            <FocusTask key={task.id} task={task} />
          ))}
          {!focus.length ? (
            <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-blue-200 bg-blue-50 text-center">
              <div>
                <CheckCircle2 className="mx-auto size-6 text-success" />
                <p className="mt-2 text-[12px] font-semibold">Priority queue is clear</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No active checks need attention.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PulseCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Layers3;
  label: string;
  value: number;
  tone: "mint" | "blue" | "amber";
}) {
  const styles = {
    mint: "bg-success-soft text-success-foreground",
    blue: "bg-info-soft text-info-foreground",
    amber: "bg-warning-soft text-warning-foreground",
  };
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
      <span className={cn("grid size-8 place-items-center rounded-full", styles[tone])}>
        <Icon className="size-3.5" />
      </span>
      <p className="num mt-3 text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </article>
  );
}

function FocusTask({ task }: { task: VerificationTask }) {
  const overdue = Boolean(task.dueAt && new Date(task.dueAt).getTime() < Date.now());
  return (
    <Link
      to="/verifier/queue"
      search={{ taskId: task.id, status: undefined }}
      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-slate-50 p-3.5 transition hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          overdue ? "bg-critical-soft text-critical" : "bg-blue-50 text-blue-700",
        )}
      >
        {overdue ? <CircleAlert className="size-4" /> : <Clock3 className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold">
          {humanize(task.check.type)} · {task.check.case.subject.fullName}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
          {task.check.case.caseNumber} · {task.check.case.client.displayName}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-[11px] font-medium",
          overdue ? "text-critical" : "text-muted-foreground",
        )}
      >
        {task.dueAt ? formatDate(task.dueAt) : "No due time"}
      </span>
    </Link>
  );
}
