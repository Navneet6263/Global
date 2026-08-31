import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { OpsMetric } from "../contracts/operations";
import { TONE_TEXT } from "@/lib/formatting/tones";
import { formatNumber } from "@/lib/formatting";
import { opsAccent } from "../accents";
import { cn } from "@/lib/utils";

const DIRECTION_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

interface OpsMetricTileProps {
  metric: OpsMetric;
  onSelect?: () => void;
}

export function OpsMetricTile({ metric, onSelect }: OpsMetricTileProps) {
  const accent = opsAccent(metric.id);
  const DeltaIcon = metric.direction ? DIRECTION_ICON[metric.direction] : Minus;
  const max = Math.max(...metric.series, 1);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex items-center gap-4 overflow-hidden rounded-[1.25rem] border border-white/80 bg-card/85 px-4 py-3.5 text-left shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raise)]"
      style={{
        borderTop: `2px solid ${accent.edge}`,
        background: `linear-gradient(180deg, ${accent.fill} 0%, color-mix(in oklab, var(--card) 85%, transparent) 60%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-full"
        style={{ background: accent.colour, opacity: 0.65 }}
      />

      <div className="min-w-0 flex-1 space-y-1 pl-1.5">
        <p className="truncate text-[11px] font-medium tracking-[0.07em] text-muted-foreground uppercase">
          {metric.label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="num text-[1.35rem] leading-none font-medium tracking-[-0.03em] text-foreground">
            {formatNumber(metric.value)}
          </span>
          {metric.deltaPercent !== undefined ? (
            <span className="inline-flex items-center gap-0.5 text-[11px]">
              <DeltaIcon className={cn("size-3", TONE_TEXT[metric.tone])} aria-hidden />
              <span className={cn("num font-medium", TONE_TEXT[metric.tone])}>
                {metric.deltaPercent > 0 ? "+" : ""}
                {metric.deltaPercent.toFixed(1)}%
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Snapshot</span>
          )}
        </div>
      </div>

      {metric.series.length ? (
        <div className="flex h-9 w-20 shrink-0 items-end gap-[2px]" aria-hidden>
          {metric.series.slice(-12).map((value, index, all) => (
            <span
              key={index}
              className="flex-1 rounded-[2px]"
              style={{
                height: `${Math.max(12, (value / max) * 100)}%`,
                background: accent.colour,
                opacity: 0.25 + (index / Math.max(all.length - 1, 1)) * 0.6,
              }}
            />
          ))}
        </div>
      ) : null}
    </button>
  );
}
