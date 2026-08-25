import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ComponentType } from "react";

type MetricTone = "blue" | "emerald" | "violet" | "amber" | "red";

const toneStyle: Record<
  MetricTone,
  { card: string; icon: string; stroke: string; fill: string; dot: string }
> = {
  blue: {
    card: "border-blue-100 bg-blue-50/35",
    icon: "bg-blue-100 text-blue-700",
    stroke: "stroke-blue-500",
    fill: "fill-blue-500/10",
    dot: "fill-blue-500",
  },
  emerald: {
    card: "border-emerald-100 bg-emerald-50/35",
    icon: "bg-emerald-100 text-emerald-700",
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500/10",
    dot: "fill-emerald-500",
  },
  violet: {
    card: "border-violet-100 bg-violet-50/35",
    icon: "bg-violet-100 text-violet-700",
    stroke: "stroke-violet-500",
    fill: "fill-violet-500/10",
    dot: "fill-violet-500",
  },
  amber: {
    card: "border-amber-100 bg-amber-50/35",
    icon: "bg-amber-100 text-amber-700",
    stroke: "stroke-amber-500",
    fill: "fill-amber-500/10",
    dot: "fill-amber-500",
  },
  red: {
    card: "border-red-100 bg-red-50/35",
    icon: "bg-red-100 text-red-700",
    stroke: "stroke-red-500",
    fill: "fill-red-500/10",
    dot: "fill-red-500",
  },
};

export function TrendMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  trend,
  lowerIsBetter = false,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: MetricTone;
  trend: Array<{ label: string; value: number }>;
  lowerIsBetter?: boolean;
  onClick?: () => void;
}) {
  const style = toneStyle[tone];
  const delta = trendDelta(trend, lowerIsBetter);
  const DeltaIcon = delta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group w-full rounded-2xl border p-4 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] disabled:cursor-default ${onClick ? "cursor-pointer" : ""} ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
          <p className="num mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${style.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <Sparkline trend={trend} stroke={style.stroke} fill={style.fill} dot={style.dot} />
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-current/5 pt-2.5">
        <span className="truncate text-[9px] text-muted-foreground">{detail}</span>
        <span
          className={`flex shrink-0 items-center gap-0.5 text-[9px] font-bold ${delta.className}`}
        >
          <DeltaIcon className="h-3 w-3" /> {delta.label}
        </span>
      </div>
    </button>
  );
}

function Sparkline({
  trend,
  stroke,
  fill,
  dot,
}: {
  trend: Array<{ label: string; value: number }>;
  stroke: string;
  fill: string;
  dot: string;
}) {
  const values = trend.map((item) => item.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 60 : (index / (values.length - 1)) * 120;
    const y = 25 - ((value - min) / range) * 20;
    return `${x},${y}`;
  });
  const area = [`0,30`, ...points, `120,30`].join(" ");
  return (
    <svg viewBox="0 0 120 30" className="mt-2 h-8 w-full" role="img" aria-label="Six month trend">
      <polygon points={area} className={fill} />
      <polyline
        points={points.join(" ")}
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
      {trend.map((item, index) => {
        const [cx, cy] = points[index]!.split(",");
        return (
          <circle key={`${item.label}-${index}`} cx={cx} cy={cy} r="1.5" className={dot}>
            <title>
              {item.label}: {item.value}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

function trendDelta(trend: Array<{ value: number }>, lowerIsBetter: boolean) {
  const current = trend.at(-1)?.value ?? 0;
  const previous = trend.at(-2)?.value ?? 0;
  if (current === previous)
    return { label: "No change", icon: ArrowRight, className: "text-muted-foreground" };
  if (!previous) return { label: "New this month", icon: ArrowUpRight, className: "text-blue-700" };
  const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const improved = lowerIsBetter ? change < 0 : change > 0;
  return {
    label: `${change > 0 ? "+" : ""}${change}% MoM`,
    icon: change > 0 ? ArrowUpRight : ArrowDownRight,
    className: improved ? "text-emerald-700" : "text-red-700",
  };
}
