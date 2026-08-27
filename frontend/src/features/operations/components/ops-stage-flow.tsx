import { AlertTriangle } from "lucide-react";
import type { OpsStageSnapshot } from "../contracts/operations";
import { OPS_STAGE_META } from "../contracts/case";
import { Section } from "@/components/layout/section";
import { formatDuration } from "@/lib/formatting";
import { TONE_STROKE } from "@/lib/formatting/tones";

export function OpsStageFlow({ stages }: { stages: readonly OpsStageSnapshot[] }) {
  const visible = stages.filter((stage) => stage.stage !== "completed");
  const max = Math.max(...visible.map((stage) => stage.count), 1);

  return (
    <Section
      title="Verification flow"
      description="Where open work is sitting right now, with average stage age and bottleneck flags."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {visible.map((stage) => {
          const meta = OPS_STAGE_META[stage.stage];
          const colour = TONE_STROKE[meta.tone];
          return (
            <div
              key={stage.stage}
              className="relative overflow-hidden rounded-[1.25rem] border border-white/80 bg-card/80 p-4 shadow-[var(--shadow-card)]"
              style={{ borderTop: `2px solid ${colour}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12px] font-medium text-foreground">{meta.short}</p>
                {stage.bottleneck ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-critical-soft px-1.5 py-px text-[10px] font-medium text-critical-foreground">
                    <AlertTriangle className="size-3" aria-hidden />
                    Bottleneck
                  </span>
                ) : null}
              </div>

              <p className="num mt-2 text-[1.4rem] leading-none font-medium tracking-[-0.03em] text-foreground">
                {stage.count}
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(stage.count / max) * 100}%`,
                    background: colour,
                    opacity: 0.75,
                  }}
                />
              </div>

              <dl className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <dt>Avg age</dt>
                  <dd className="num">{formatDuration(stage.averageAgeMinutes)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Oldest</dt>
                  <dd className="num">{formatDuration(stage.oldestAgeMinutes)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>SLA risk / unassigned</dt>
                  <dd className="num">
                    {stage.slaRiskCount} / {stage.unassignedCount}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
