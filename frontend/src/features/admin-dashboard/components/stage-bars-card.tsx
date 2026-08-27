import { Link } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import type { PipelineStage } from "@/lib/contracts/dashboard";
import { STAGE_META } from "@/lib/contracts/case";

/** Photo-style bar statistic: ghost track behind each bar, bottleneck bars in amber. */
export function StageBarsCard({ stages }: { stages: readonly PipelineStage[] }) {
  const peak = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-xl bg-mint-soft text-mint-deep">
          <BarChart3 className="size-4" aria-hidden />
        </span>
        <span className="flex-1 text-[13px] font-semibold text-foreground">Stage statistic</span>
        <span className="rounded-full bg-mint-soft/70 px-2.5 py-1 text-[11px] text-mint-deep">
          Live
        </span>
      </div>

      <div className="mt-4 flex h-[104px] items-end gap-2">
        {stages.map((stage) => {
          const meta = STAGE_META[stage.stage];
          const fill = Math.max(10, Math.round((stage.count / peak) * 100));
          return (
            <Link
              key={stage.stage}
              to="/admin/cases"
              search={{ stage: stage.stage }}
              title={`${meta.label} — ${stage.count} cases`}
              className="group relative flex h-full flex-1 items-end justify-center rounded-[0.6rem] bg-mint-soft/60 transition-colors hover:bg-mint-soft"
            >
              <span
                className="w-full rounded-[0.6rem] transition-[height] duration-700"
                style={{
                  height: `${fill}%`,
                  background: stage.isBottleneck
                    ? "linear-gradient(180deg, oklch(0.86 0.16 88), oklch(0.79 0.15 82))"
                    : "linear-gradient(180deg, oklch(0.72 0.09 168), oklch(0.56 0.088 168))",
                }}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2">
        {stages.map((stage) => (
          <span
            key={stage.stage}
            className="flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {STAGE_META[stage.stage].label.split(" ")[0]}
          </span>
        ))}
      </div>
    </section>
  );
}
