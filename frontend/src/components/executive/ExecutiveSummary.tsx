import { Link } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";

import { TrendMetricCard } from "@/components/dashboards/TrendMetricCard";
import type { ExecutiveDashboard } from "@/lib/api/dashboards";
import type { ExecutiveDrilldownSelection } from "./ExecutiveDrilldown";

export function ExecutiveHeader() {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 px-1 py-1">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-orange-700">
          Command / Executive
        </p>
        <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">Portfolio intelligence</h1>
      </div>
      <Link
        to="/"
        className="inline-flex h-9 items-center gap-2 rounded-xl bg-foreground px-3.5 text-xs font-semibold text-background transition hover:opacity-90"
      >
        Control tower <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </header>
  );
}

export function ExecutiveKpis({
  data,
  onDrilldown,
}: {
  data: ExecutiveDashboard;
  onDrilldown: (selection: ExecutiveDrilldownSelection) => void;
}) {
  const trend = data.performanceTrend ?? [];
  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <TrendMetricCard
        label="Portfolio"
        value={number(data.summary.total)}
        detail="New case intake"
        icon={BriefcaseBusiness}
        tone="blue"
        trend={trend.map((point) => ({ label: point.month, value: point.created }))}
        onClick={() => onDrilldown({ kind: "all", label: "Portfolio cases" })}
      />
      <TrendMetricCard
        label="SLA health"
        value={data.performance.slaPercentage === null ? "—" : `${data.performance.slaPercentage}%`}
        detail={
          data.performance.slaPercentage === null
            ? "No SLA-eligible cases yet"
            : "Within committed due date"
        }
        icon={CheckCircle2}
        tone="emerald"
        trend={trend.flatMap((point) =>
          point.slaPercentage === null ? [] : [{ label: point.month, value: point.slaPercentage }],
        )}
        onClick={() => onDrilldown({ kind: "sla", label: "SLA-eligible completed cases" })}
      />
      <TrendMetricCard
        label="Average TAT"
        value={data.performance.completedCases ? `${data.performance.averageTatHours}h` : "—"}
        detail={
          data.performance.completedCases ? "Completion turnaround" : "No completed cases yet"
        }
        icon={Clock3}
        tone="violet"
        lowerIsBetter
        trend={trend.flatMap((point) =>
          point.averageTatHours === null
            ? []
            : [{ label: point.month, value: point.averageTatHours }],
        )}
        onClick={() =>
          onDrilldown({ kind: "tat", label: "Completed cases in turnaround calculation" })
        }
      />
      <TrendMetricCard
        label="SLA exposure"
        value={number(data.summary.overdue)}
        detail="Overdue due-date cohort"
        icon={ShieldAlert}
        tone={data.summary.overdue ? "red" : "emerald"}
        lowerIsBetter
        trend={trend.map((point) => ({ label: point.month, value: point.overdue }))}
        onClick={() => onDrilldown({ kind: "overdue", label: "Overdue SLA exposure" })}
      />
    </section>
  );
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}
