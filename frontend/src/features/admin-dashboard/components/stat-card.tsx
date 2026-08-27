import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Gauge, MoreHorizontal, Timer } from "lucide-react";
import type { SummaryCard as SummaryCardData } from "@/lib/contracts/dashboard";
import { Sparkline } from "@/components/charts/sparkline";
import { cardAccent } from "../accents";

const ICONS: Record<string, typeof Gauge> = {
  "sla-health": Gauge,
  "completion-time": Timer,
};

export function StatCard({ card }: { card: SummaryCardData }) {
  const accent = cardAccent(card.id);
  const Icon = ICONS[card.id] ?? Gauge;
  const rising = card.comparison.direction !== "down";
  const DeltaIcon = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <Link
      to={card.target.route as "/admin/cases"}
      search={(card.target.search ?? {}) as never}
      className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raise)]"
      style={{
        borderTop: `2px solid ${accent.edge}`,
        background: `linear-gradient(180deg, ${accent.fill} 0%, color-mix(in oklab, var(--card) 85%, transparent) 55%)`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 items-center justify-center rounded-xl border"
          style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
          {card.label}
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground/50" aria-hidden />
      </div>

      <div className="-mx-1 mt-2">
        <Sparkline data={card.series} tone={card.tone} accent={accent.colour} height={76} />
      </div>

      <div className="mt-1 flex items-end gap-2">
        <span className="num text-[1.7rem] leading-none font-medium tracking-[-0.04em] text-foreground">
          {card.value}
        </span>
        <span
          className="num mb-0.5 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
        >
          <DeltaIcon className="size-3" aria-hidden />
          {card.comparison.delta > 0 ? "+" : ""}
          {card.comparison.delta}%
        </span>
      </div>
    </Link>
  );
}
