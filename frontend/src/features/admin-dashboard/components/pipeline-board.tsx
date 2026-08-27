import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Flame } from "lucide-react";
import type { PipelineStage } from "@/lib/contracts/dashboard";
import { STAGE_META } from "@/lib/contracts/case";
import { Section } from "@/components/layout/section";
import { formatDuration } from "@/lib/formatting";
import { TONE_STROKE } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

const MODE_LABEL = {
  processing: "In motion",
  waiting: "Waiting",
  closed: "Closed",
} as const;

export function PipelineBoard({ stages }: { stages: readonly PipelineStage[] }) {
  const peak = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <Section
      title="Verification flow"
      description="Live stage distribution of the active portfolio. Select a stage to open its filtered register."
      actions={
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Flame className="size-3.5 text-critical/70" aria-hidden />
          Bottleneck highlighted
        </span>
      }
      bodyClassName="p-4"
    >
      <ol className="flex snap-x gap-1 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const meta = STAGE_META[stage.stage];
          const accent = TONE_STROKE[meta.tone];
          const fill = Math.max(8, Math.round((stage.count / peak) * 100));
          return (
            <li key={stage.stage} className="flex min-w-[190px] flex-1 snap-start items-stretch">
              <Link
                to="/admin/cases"
                search={{ stage: stage.stage }}
                className={cn(
                  "group relative flex flex-1 flex-col justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)]",
                  stage.isBottleneck
                    ? "border-critical/30 bg-critical-soft/30"
                    : "border-border bg-card hover:border-border-strong",
                )}
                style={{
                  borderTop: `2px solid ${accent}`,
                  background: stage.isBottleneck
                    ? undefined
                    : `linear-gradient(180deg, color-mix(in oklab, ${accent} 10%, transparent) 0%, color-mix(in oklab, var(--card) 92%, transparent) 55%)`,
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                      {MODE_LABEL[stage.mode]}
                    </span>
                    <span className="num text-[10px] text-muted-foreground">
                      {stage.shareOfPortfolio}%
                    </span>
                  </div>
                  <p className="text-[13px] leading-snug font-medium text-foreground">
                    {meta.label}
                  </p>
                </div>

                {/* column height = volume in this stage */}
                <div className="flex h-14 items-end gap-2.5">
                  <span
                    className="w-1.5 rounded-full transition-[height] duration-700"
                    style={{ height: `${fill}%`, backgroundColor: accent, opacity: 0.8 }}
                    aria-hidden
                  />
                  <span className="num text-2xl leading-none font-medium tracking-[-0.03em] text-foreground">
                    {stage.count}
                  </span>
                </div>

                <dl className="space-y-1 border-t border-border/70 pt-2.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <dt>Avg age</dt>
                    <dd className="num font-medium text-foreground">
                      {stage.averageAgeMinutes === 0
                        ? "—"
                        : formatDuration(stage.averageAgeMinutes)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt>{stage.slaRiskCount > 0 ? "At risk" : "Status"}</dt>
                    <dd className="num inline-flex items-center gap-1.5 font-medium text-foreground">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          stage.slaRiskCount === 0 && "bg-success/70",
                          stage.slaRiskCount > 0 && stage.isBottleneck && "bg-critical",
                          stage.slaRiskCount > 0 && !stage.isBottleneck && "bg-warning",
                        )}
                        aria-hidden
                      />
                      {stage.slaRiskCount > 0 ? stage.slaRiskCount : "On track"}
                    </dd>
                  </div>
                </dl>

                {stage.isBottleneck ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-critical-foreground">
                    <AlertTriangle className="size-3" aria-hidden />
                    Oldest work ageing here
                  </p>
                ) : null}
              </Link>

              {index < stages.length - 1 ? (
                <span className="flex w-4 items-center justify-center" aria-hidden>
                  <ChevronRight className="size-3.5 text-border-strong" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
