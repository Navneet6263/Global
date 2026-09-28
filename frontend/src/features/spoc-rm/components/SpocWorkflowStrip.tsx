import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { OversightPanel, OversightPill } from "@/features/admin-dashboard/components/oversight-ui";
import type { SpocStage } from "../contracts/spoc";
import { HOLDER_LABEL } from "../config/spoc-meta";
import { age, label } from "../utils/spoc-format";
import type { SpocScopeFilters } from "./SpocFilterBar";

/** The 12 real case statuses in lifecycle order, with who holds each and how old the oldest case is. */
export function SpocWorkflowStrip({
  stages,
  scope,
}: {
  stages: readonly SpocStage[];
  scope: SpocScopeFilters;
}) {
  const live = stages.filter((stage) => stage.holderRole !== "NONE");
  const busiest = live.reduce<SpocStage | undefined>(
    (top, stage) => (!top || stage.count > top.count ? stage : top),
    undefined,
  );

  return (
    <OversightPanel
      title="Where work is sitting"
      description="Case lifecycle stages with the role that must act next. Closed stages are all-time totals."
      toolbar={
        busiest?.count ? (
          <OversightPill tone="amber">{`${label(busiest.status)} is busiest`}</OversightPill>
        ) : (
          <OversightPill tone="mint">No active backlog</OversightPill>
        )
      }
    >
      <ol className="flex snap-x gap-1 overflow-x-auto p-4">
        {stages.map((stage, index) => (
          <li key={stage.status} className="flex min-w-[150px] flex-1 snap-start items-stretch">
            <Link
              to="/spoc-rm/records"
              search={{ ...scope, domain: "cases", status: stage.status }}
              className={`flex flex-1 flex-col justify-between rounded-2xl border p-3 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/35 focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:outline-none ${
                stage === busiest && stage.count > 0
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card/80"
              }`}
            >
              <p className="text-[11px] font-semibold text-foreground">{label(stage.status)}</p>
              <p className="num mt-3 text-2xl font-medium tracking-[-0.03em] text-foreground">
                {stage.count}
              </p>
              <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                <p>{HOLDER_LABEL[stage.holderRole]}</p>
                {stage.holderRole !== "NONE" ? (
                  <p>
                    Oldest {age(stage.oldestAgeHours)}
                    {stage.atRisk ? (
                      <span className="text-critical-foreground"> · {stage.atRisk} at risk</span>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </Link>
            {index < stages.length - 1 ? (
              <span className="flex w-4 items-center justify-center" aria-hidden>
                <ArrowRight className="size-3.5 text-border-strong" />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </OversightPanel>
  );
}
