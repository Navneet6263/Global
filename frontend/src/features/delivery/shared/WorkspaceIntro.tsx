import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function WorkspaceIntro({
  eyebrow,
  title,
  description,
  signal,
}: {
  eyebrow: string;
  title: string;
  description: string;
  signal?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[1.7rem] font-semibold tracking-[-0.035em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {signal ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-card/80 px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-card)] backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-success shadow-[0_0_0_4px_var(--success-soft)]" />
          {signal}
        </div>
      ) : null}
    </header>
  );
}

export type WorkspaceMetricTone = "mint" | "blue" | "amber" | "red" | "violet";

const TONES: Record<WorkspaceMetricTone, { line: string; icon: string; fill: string }> = {
  mint: {
    line: "var(--success)",
    icon: "bg-success-soft text-success-foreground",
    fill: "bg-success",
  },
  blue: { line: "var(--info)", icon: "bg-info-soft text-info-foreground", fill: "bg-info" },
  amber: {
    line: "var(--warning)",
    icon: "bg-warning-soft text-warning-foreground",
    fill: "bg-warning",
  },
  red: {
    line: "var(--critical)",
    icon: "bg-critical-soft text-critical-foreground",
    fill: "bg-critical",
  },
  violet: {
    line: "var(--review)",
    icon: "bg-review-soft text-review-foreground",
    fill: "bg-review",
  },
};

export interface WorkspaceMetric {
  label: string;
  value: number | string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: WorkspaceMetricTone;
  share?: number;
}

export function WorkspaceMetricGrid({ items }: { items: WorkspaceMetric[] }) {
  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Live workspace summary"
    >
      {items.map((metric) => {
        const tone = TONES[metric.tone];
        return (
          <article
            key={metric.label}
            className="group relative overflow-hidden rounded-[1.45rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]"
            style={{ borderTop: `2px solid ${tone.line}` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="num mt-2 text-[1.75rem] font-semibold leading-none tracking-[-0.04em]">
                  {metric.value}
                </p>
              </div>
              <span className={cn("grid size-9 place-items-center rounded-full", tone.icon)}>
                <metric.icon className="size-4" />
              </span>
            </div>
            <p className="mt-3 truncate text-[10.5px] text-muted-foreground">{metric.detail}</p>
            {metric.share !== undefined ? (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-500", tone.fill)}
                  style={{
                    width: `${Math.max(metric.share ? 4 : 0, Math.min(100, metric.share))}%`,
                  }}
                />
              </div>
            ) : (
              <div className="mt-3 h-1 rounded-full bg-muted/45" aria-hidden />
            )}
          </article>
        );
      })}
    </section>
  );
}
