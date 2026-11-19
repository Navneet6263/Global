import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Meter } from "./controls";
import { DOT, SOFT, type Tone } from "./display";

export interface Metric {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** 0-100; draws a thin meter and the percent in the corner. */
  progress?: number;
  tone?: "brand" | "good" | "warn" | "bad" | "note";
  /** Turns the value red, e.g. overdue work. */
  alarm?: boolean;
  to?: string;
  search?: Record<string, unknown>;
  /** Small coloured tile beside the label. */
  icon?: LucideIcon;
}

const CARD =
  "flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface shadow-soft px-4 py-3 text-left";

function MetricBody({ metric }: { metric: Metric }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[11px] font-semibold tracking-wider text-dim uppercase">
          {metric.label}
        </p>
        {metric.progress !== undefined ? (
          <span className="font-mono text-xs text-dim">{metric.progress}%</span>
        ) : null}
        {metric.icon ? (
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg",
              SOFT[metric.tone ?? "brand"],
            )}
          >
            <metric.icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "font-mono text-[28px] leading-none font-semibold tabular-nums",
          metric.alarm ? "text-bad" : "text-ink",
        )}
      >
        {metric.value}
      </p>
      {metric.progress !== undefined ? (
        <Meter value={metric.progress} tone={metric.tone} label={`${metric.label} share`} />
      ) : (
        <div className="h-1.5" />
      )}
      {metric.note ? <span className="truncate text-xs text-dim">{metric.note}</span> : null}
    </>
  );
}

/** A row of headline numbers, as on the Task dashboard. */
export function MetricCards({ label, metrics }: { label: string; metrics: Metric[] }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) =>
        metric.to ? (
          <Link
            key={metric.label}
            to={metric.to as "/"}
            search={metric.search as never}
            className={cn(
              CARD,
              "transition hover:-translate-y-px hover:border-brand/40 hover:shadow-lift",
            )}
          >
            <MetricBody metric={metric} />
          </Link>
        ) : (
          <article key={metric.label} className={CARD}>
            <MetricBody metric={metric} />
          </article>
        ),
      )}
    </section>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

/** One stacked bar drawn to scale, with a legend; legend items can be buttons. */
export function StatusBar({
  title,
  unit,
  segments,
  selected,
  onSelect,
  action,
}: {
  title: string;
  unit: string;
  segments: Segment[];
  selected?: string;
  onSelect?: (key: string) => void;
  action?: ReactNode;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-line bg-surface shadow-soft px-4 py-3"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="flex items-center gap-3 font-mono text-xs text-dim">
          {total} {unit}
          {action}
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-subtle">
        {total > 0
          ? segments.map((segment) =>
              segment.value ? (
                <div
                  key={segment.key}
                  className={cn("h-full", DOT[segment.tone])}
                  style={{ width: `${(segment.value / total) * 100}%` }}
                  title={`${segment.label}: ${segment.value}`}
                />
              ) : null,
            )
          : null}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((segment) => {
          const content = (
            <>
              <span className={cn("size-2 rounded-full", DOT[segment.tone])} aria-hidden />
              {segment.label}
              <b className="font-mono font-semibold text-ink">{segment.value}</b>
            </>
          );
          return (
            <li key={segment.key}>
              {onSelect ? (
                <button
                  type="button"
                  aria-pressed={selected === segment.key}
                  onClick={() => onSelect(segment.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-dim hover:bg-subtle hover:text-ink",
                    selected === segment.key && "bg-brand-soft text-ink",
                  )}
                >
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-1.5 px-1.5 py-0.5 text-xs text-dim">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
