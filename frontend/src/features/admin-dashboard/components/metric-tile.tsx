import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { SummaryCard as SummaryCardData } from "@/lib/contracts/dashboard";
import { TONE_TEXT } from "@/lib/formatting/tones";
import { cardAccent } from "../accents";
import { cn } from "@/lib/utils";

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

export function MetricTile({ card }: { card: SummaryCardData }) {
  const accent = cardAccent(card.id);
  const DeltaIcon = DIRECTION_ICON[card.comparison.direction];
  const values = card.series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return (
    <Link
      to={card.target.route as "/admin/cases"}
      search={(card.target.search ?? {}) as never}
      className="group relative flex items-center gap-4 overflow-hidden rounded-[1.25rem] border border-white/80 bg-card/85 px-4 py-3.5 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raise)]"
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
          {card.label}
        </p>
        <div className="flex items-baseline gap-2">
          <span className="num text-[1.35rem] leading-none font-medium tracking-[-0.03em] text-foreground">
            {card.value}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px]">
            <DeltaIcon className={cn("size-3", TONE_TEXT[card.tone])} aria-hidden />
            <span className={cn("num font-medium", TONE_TEXT[card.tone])}>
              {card.comparison.delta > 0 ? "+" : ""}
              {card.comparison.delta}%
            </span>
          </span>
        </div>
      </div>

      {/* micro bars: each column is the reading for that day */}
      <div className="flex h-9 w-20 shrink-0 items-end gap-[2px]" aria-hidden>
        {card.series.slice(-12).map((point, index, all) => (
          <span
            key={point.label}
            className="flex-1 rounded-[2px] transition-[height] duration-500"
            style={{
              height: `${20 + ((point.value - min) / spread) * 80}%`,
              backgroundColor: accent.colour,
              opacity: index === all.length - 1 ? 0.95 : 0.3 + (index / all.length) * 0.45,
            }}
          />
        ))}
      </div>
    </Link>
  );
}
