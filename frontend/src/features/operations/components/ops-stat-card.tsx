import { ArrowDownRight, ArrowUpRight, Gauge, MoreHorizontal, Timer, UserPlus } from "lucide-react";
import type { OpsMetric } from "../contracts/operations";
import { Sparkline } from "@/components/charts/sparkline";
import { formatNumber } from "@/lib/formatting";
import { opsAccent } from "../accents";

const ICONS: Record<string, typeof Gauge> = {
  slaRisk: Gauge,
  dueToday: Timer,
  unassigned: UserPlus,
};

interface OpsStatCardProps {
  metric: OpsMetric;
  onSelect?: () => void;
}

export function OpsStatCard({ metric, onSelect }: OpsStatCardProps) {
  const accent = opsAccent(metric.id);
  const Icon = ICONS[metric.id] ?? Gauge;
  const DeltaIcon = metric.direction === "down" ? ArrowDownRight : ArrowUpRight;
  const points = metric.series.map((value, index) => ({ label: `d${index}`, value }));

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/80 bg-card/85 p-4 text-left shadow-[var(--shadow-card)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-raise)]"
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
          {metric.label}
        </span>
        <MoreHorizontal className="size-4 text-muted-foreground/50" aria-hidden />
      </div>

      <div className="-mx-1 mt-2">
        <Sparkline data={points} tone={metric.tone} accent={accent.colour} height={76} />
      </div>

      <div className="mt-1 flex items-end gap-2">
        <span className="num text-[1.7rem] leading-none font-medium tracking-[-0.04em] text-foreground">
          {formatNumber(metric.value)}
        </span>
        <span
          className="num mb-0.5 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ background: accent.fill, borderColor: accent.edge, color: accent.colour }}
        >
          <DeltaIcon className="size-3" aria-hidden />
          {metric.deltaPercent > 0 ? "+" : ""}
          {metric.deltaPercent.toFixed(1)}%
        </span>
      </div>
    </button>
  );
}
