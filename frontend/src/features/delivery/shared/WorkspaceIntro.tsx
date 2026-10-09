import type { ComponentType, ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/workspace/kit";
import type { Tone } from "@/components/workspace/tones";

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

const TONE: Record<WorkspaceMetricTone, Tone> = {
  mint: "good",
  blue: "info",
  amber: "warn",
  red: "bad",
  violet: "violet",
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
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Live workspace summary">
      {items.map((metric) => (
        <StatCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
          hint={metric.detail}
          tone={TONE[metric.tone]}
          share={metric.share}
        />
      ))}
    </section>
  );
}
