import type { ComponentType, ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

/** Compact workspace header (one line; the description is for assistive tech). */
export function WorkspaceIntro({
  title,
  description,
  signal,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  signal?: ReactNode;
  actions?: ReactNode;
}) {
  return <PageHeader title={title} description={description} meta={signal} actions={actions} />;
}

export type WorkspaceMetricTone = "mint" | "blue" | "amber" | "red" | "violet";

const ICON: Record<WorkspaceMetricTone, string> = {
  mint: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-700",
};
const BAR: Record<WorkspaceMetricTone, string> = {
  mint: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

export interface WorkspaceMetric {
  label: string;
  value: number | string;
  detail: string;
  icon: ComponentType<{ className?: string }>;
  tone: WorkspaceMetricTone;
  /** 0–100: share of the related total, drawn as a thin bar when above zero. */
  share?: number;
}

/** Compact KPI cards: label and icon, the number, one line of context. */
export function WorkspaceMetricGrid({ items }: { items: WorkspaceMetric[] }) {
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live workspace summary">
      {items.map((metric) => {
        const Icon = metric.icon;
        const alert = metric.tone === "red" && Number(metric.value) > 0;
        return (
          <div
            key={metric.label}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[12.5px] font-medium text-slate-500">{metric.label}</p>
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg",
                  ICON[metric.tone],
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <p
              className={cn(
                "num mt-1 text-[28px] font-semibold leading-tight tracking-tight",
                alert ? "text-red-600" : "text-slate-900",
              )}
            >
              {metric.value}
            </p>
            <p className="mt-1 truncate text-[12px] text-slate-500" title={metric.detail}>
              {metric.detail}
            </p>
            {metric.share ? (
              <span
                className="mt-2 block h-1 overflow-hidden rounded-full bg-slate-100"
                aria-hidden
              >
                <span
                  className={cn("block h-full rounded-full", BAR[metric.tone])}
                  style={{ width: `${Math.max(4, Math.min(100, metric.share))}%` }}
                />
              </span>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
