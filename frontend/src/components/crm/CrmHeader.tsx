import { CircleDollarSign, Plus, Target, Trophy, UsersRound } from "lucide-react";

import { TrendMetricCard } from "@/components/dashboards/TrendMetricCard";
import { money } from "@/components/crm/crm-utils";
import type { CrmOverview } from "@/lib/api/crm";

export function CrmHeader({ onNew }: { onNew: () => void }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-1 py-1">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-700">
          Command / Sales
        </p>
        <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">Revenue command</h1>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background transition hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" /> New opportunity
      </button>
    </header>
  );
}

export function CrmKpis({ data }: { data: CrmOverview }) {
  const trend = data.trend ?? [];
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <TrendMetricCard
        label="Open pipeline"
        value={money(data.summary.openValue)}
        detail={`${data.summary.openCount} active opportunities`}
        icon={CircleDollarSign}
        tone="blue"
        trend={trend.map((point) => ({ label: point.month, value: point.pipelineValue }))}
      />
      <TrendMetricCard
        label="Weighted forecast"
        value={money(data.summary.weightedValue)}
        detail="Probability-adjusted intake"
        icon={Target}
        tone="amber"
        trend={trend.map((point) => ({ label: point.month, value: point.weightedValue }))}
      />
      <TrendMetricCard
        label="Closed won"
        value={money(data.summary.wonValue)}
        detail="Revenue closed by month"
        icon={Trophy}
        tone="emerald"
        trend={trend.map((point) => ({ label: point.month, value: point.wonValue }))}
      />
      <TrendMetricCard
        label="Active owners"
        value={String(data.summary.activeOwners ?? 0)}
        detail="Owners creating opportunities"
        icon={UsersRound}
        tone="violet"
        trend={trend.map((point) => ({ label: point.month, value: point.activeOwners }))}
      />
    </section>
  );
}
