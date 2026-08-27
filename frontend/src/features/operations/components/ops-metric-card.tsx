import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { OpsMetric } from "../contracts/operations";
import { formatNumber } from "@/lib/formatting";
import { TONE_STROKE, TONE_TEXT } from "@/lib/formatting/tones";
import { cn } from "@/lib/utils";

const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

interface OpsMetricCardProps {
  metric: OpsMetric;
  active?: boolean;
  onSelect?: () => void;
}

export function OpsMetricCard({ metric, active, onSelect }: OpsMetricCardProps) {
  const DeltaIcon = DIRECTION_ICON[metric.direction];
  const colour = TONE_STROKE[metric.tone];
  const max = Math.max(...metric.series, 1);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-[1.35rem] border border-white/80 bg-card/85 px-4 py-4 text-left shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]",
        active ? "ring-2 ring-primary/35" : "",
      )}
      style={{
        borderTop: `2px solid ${colour}`,
        background: `linear-gradient(180deg, color-mix(in oklab, ${colour} 9%, transparent) 0%, color-mix(in oklab, var(--card) 88%, transparent) 62%)`,
      }}
    >
      <span className="text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
        {metric.label}
      </span>

      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="num block text-[1.6rem] leading-none font-medium tracking-[-0.03em] text-foreground">
            {formatNumber(metric.value)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px]">
            <DeltaIcon className={cn("size-3", TONE_TEXT[metric.tone])} aria-hidden />
            <span className={cn("num font-medium", TONE_TEXT[metric.tone])}>
              {metric.deltaPercent > 0 ? "+" : ""}
              {metric.deltaPercent.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">vs yesterday</span>
          </span>
        </div>

        <div className="flex h-9 w-24 shrink-0 items-end gap-[2px]" aria-hidden>
          {metric.series.map((value, index, all) => (
            <span
              key={index}
              className="flex-1 rounded-[2px]"
              style={{
                height: `${Math.max(12, (value / max) * 100)}%`,
                background: colour,
                opacity: 0.25 + (index / Math.max(all.length - 1, 1)) * 0.6,
              }}
            />
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{metric.explanation}</p>
    </button>
  );
}
