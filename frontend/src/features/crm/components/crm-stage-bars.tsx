import type { CrmStageSnapshot } from "../contracts/crm";
import { STAGE_LABEL } from "../config/crm";
import { STAGE_ACCENT_KEYS, crmAccent } from "../accents";
import { formatInr } from "@/lib/formatting";

interface CrmStageBarsProps {
  stages: readonly CrmStageSnapshot[];
  onSelectStage?: (stage: CrmStageSnapshot["stage"]) => void;
}

export function CrmStageBars({ stages, onSelectStage }: CrmStageBarsProps) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
          Pipeline by stage
        </h2>
        <p className="text-[11px] text-muted-foreground">Bar height = open value in that stage</p>
      </div>

      <div className="flex items-end gap-3 overflow-x-auto pb-1">
        {stages.map((stage, index) => {
          const accent = crmAccent(STAGE_ACCENT_KEYS[index % STAGE_ACCENT_KEYS.length]!);
          const height = Math.max(12, Math.round((stage.value / max) * 128));

          return (
            <button
              key={stage.stage}
              type="button"
              onClick={() => onSelectStage?.(stage.stage)}
              className="group flex min-w-[92px] flex-1 flex-col items-center gap-2 rounded-[1.1rem] px-2 py-2 transition-colors hover:bg-mint-soft/50"
            >
              <span className="num text-[11px] font-medium text-foreground">
                {formatInr(stage.value, { compact: true })}
              </span>
              <span
                className="relative flex w-full items-end justify-center rounded-[0.9rem]"
                style={{ height: 136, background: "oklch(0.95 0.008 150 / 0.7)" }}
              >
                <span
                  className="w-full rounded-[0.9rem] transition-all duration-300 group-hover:opacity-90"
                  style={{
                    height,
                    background: `linear-gradient(180deg, ${accent.colour}, ${accent.edge})`,
                  }}
                />
              </span>
              <span className="text-[11px] font-medium text-foreground">
                {STAGE_LABEL[stage.stage]}
              </span>
              <span className="num text-[10px] text-muted-foreground">
                {stage.count} deals · {stage.averageAgeDays}d avg
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
