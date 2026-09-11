import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";

export function WorkspaceIntro({
  title,
  description,
  signal,
}: {
  eyebrow: string;
  title: string;
  description: string;
  signal?: ReactNode;
}) {
  return <PageHeader title={title} description={description} meta={signal} />;
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
