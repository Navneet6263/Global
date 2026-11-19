import { Check, CheckCircle2 } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { Meter } from "@/kit";
import { cn } from "@/lib/utils";
import { caseDate, caseJourney } from "./client-case-activity";

/** One card: the case journey as a connected stepper, plus how many checks are done. */
export function ClientCaseProgress({
  item,
  label,
  detail,
}: {
  item: CaseDetail;
  label: string;
  detail: string | null;
}) {
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  const percent = item.checks.length ? Math.round((completed / item.checks.length) * 100) : 0;
  const recorded = new Set(
    item.statusHistory.flatMap((event) => [event.fromStatus, event.toStatus]),
  );
  const current = caseJourney.findIndex((stage) => stage.statuses.includes(item.status));
  return (
    <section
      aria-label="Case progress"
      className="rounded-xl border border-line bg-surface p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wider text-dim uppercase">Progress</p>
          <p className="mt-0.5 text-base font-bold text-ink">{label}</p>
          <p className="text-sm text-dim">
            {detail ?? `${completed} of ${item.checks.length} checks completed`}
          </p>
        </div>
        <div className="w-40 text-right">
          <strong className="font-mono text-[28px] leading-none font-semibold text-ink">
            {percent}%
          </strong>
          <span className="mb-1.5 block text-[11px] text-dim">
            {completed}/{item.checks.length} checks complete
          </span>
          <Meter
            value={percent}
            tone={percent === 100 ? "good" : "brand"}
            label="Checks completed"
          />
        </div>
      </div>
      <ol
        aria-label="Recorded case journey"
        className="mt-5 grid grid-cols-3 gap-y-4 sm:grid-cols-6"
      >
        {caseJourney.map((stage, index) => {
          const active = index === current;
          const done = !active && (index < current || stage.statuses.some((s) => recorded.has(s)));
          return (
            <li
              key={stage.label}
              aria-current={active ? "step" : undefined}
              className="relative flex flex-col items-center px-1 text-center"
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3.5 right-1/2 h-0.5 w-full -translate-x-3.5",
                    index % 3 === 0 && "max-sm:hidden",
                    index <= current ? "bg-brand-bright" : "bg-line",
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 grid size-7 place-items-center rounded-full border-2 font-mono text-xs font-bold",
                  active
                    ? "border-brand bg-brand text-brand-fg ring-4 ring-brand/15"
                    : done
                      ? "border-brand-bright bg-brand-soft text-brand"
                      : "border-line bg-surface text-dim",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <strong
                className={cn(
                  "mt-2 text-xs leading-4",
                  active ? "font-bold text-ink" : "font-semibold text-ink/80",
                )}
              >
                {stage.label}
              </strong>
              <span className={cn("text-[11px]", active ? "font-semibold text-brand" : "text-dim")}>
                {active ? "Current stage" : done ? "Recorded" : "Not recorded"}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-dim">
        Recorded stages are not a guarantee that every check passed.
      </p>
      {item.clientProgress?.candidateSubmittedAt ? (
        <p
          className="mt-3 flex items-center gap-2 rounded-md bg-good-soft px-3 py-2 text-xs font-medium text-good"
          role="status"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Candidate uploaded all documents on {caseDate(item.clientProgress.candidateSubmittedAt)}.
        </p>
      ) : null}
    </section>
  );
}
