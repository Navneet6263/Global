import { CircleDot } from "lucide-react";
import type { CaseWorkflowSummary } from "./case-workflow-summary";
import { formatDateTime } from "@/lib/formatting";

export function CaseProgressSummary({ summary }: { summary: CaseWorkflowSummary }) {
  return (
    <section
      aria-label="Current case responsibility"
      className="overflow-hidden rounded-2xl border border-sky-100 bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-sky-50/70 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CircleDot className="size-4 text-sky-600" aria-hidden />{" "}
          {summary.closed ? "Case closed" : "Who needs to act now?"}
        </h2>
        <span className="text-xs text-muted-foreground">
          {summary.completedChecks}/{summary.totalChecks} checks completed
        </span>
      </header>
      <ul className="divide-y divide-border/60">
        {summary.pending.map((row, index) => (
          <li
            key={`${row.role}-${index}`}
            className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3"
          >
            <span className="font-semibold text-sky-800">{row.role}</span>
            <div className="min-w-0 space-y-1">
              <p className="break-words font-medium">{row.owner}</p>
              <p className="break-words text-muted-foreground capitalize">{row.reason}</p>
              {row.since ? (
                <p className="text-[11px] text-muted-foreground">
                  {row.sinceLabel} {formatDateTime(row.since)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <footer className="space-y-2 border-t border-border/60 bg-secondary/20 px-4 py-3 text-xs">
        <p className="flex items-center gap-2">
          <CircleDot className="size-3.5 shrink-0 text-teal-600" aria-hidden />
          {summary.field}
        </p>
        <p>
          <span className="font-semibold">Next: </span>
          <span className="text-muted-foreground">{summary.next}</span>
        </p>
      </footer>
    </section>
  );
}

export function PendingCaseLabel({ summary }: { summary?: CaseWorkflowSummary }) {
  if (!summary) return null;
  const roles = [...new Set(summary.pending.map((row) => row.role))];
  return (
    <span className="block max-w-72 space-y-1 text-xs">
      <span className="block font-medium text-sky-800">
        {summary.closed ? "No active work" : `Pending: ${roles.join(" + ")}`}
      </span>
      <span className="block text-[11px] text-muted-foreground">
        {summary.pending[0]?.reason ?? summary.next}
        {summary.pending.length > 1 ? ` · +${summary.pending.length - 1} more` : ""}
      </span>
    </span>
  );
}
