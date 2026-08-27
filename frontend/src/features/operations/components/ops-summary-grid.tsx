import type { OpsDashboard, OpsMetric, OpsMetricId } from "../contracts/operations";
import { OpsWorkloadCard } from "./ops-workload-card";
import { OpsTrendCard } from "./ops-trend-card";
import { OpsStatCard } from "./ops-stat-card";
import { OpsStageBarsCard } from "./ops-stage-bars-card";
import { OpsMetricTile } from "./ops-metric-tile";

interface OpsSummaryGridProps {
  metrics: readonly OpsMetric[];
  stages: OpsDashboard["stages"];
  throughput: OpsDashboard["throughput"];
  onSelectMetric: (id: OpsMetricId) => void;
}

const HERO_IDS: readonly string[] = ["active", "completedToday", "slaRisk", "dueToday"];

export function OpsSummaryGrid({
  metrics,
  stages,
  throughput,
  onSelectMetric,
}: OpsSummaryGridProps) {
  const find = (id: OpsMetricId) => metrics.find((metric) => metric.id === id);
  const active = find("active");
  const completed = find("completedToday");
  const slaRisk = find("slaRisk");
  const dueToday = find("dueToday");
  const tiles = metrics.filter((metric) => !HERO_IDS.includes(metric.id));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {active ? <OpsWorkloadCard workload={active} completed={completed} /> : null}
        <OpsTrendCard data={throughput} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
        {slaRisk ? (
          <OpsStatCard metric={slaRisk} onSelect={() => onSelectMetric("slaRisk")} />
        ) : null}
        {dueToday ? (
          <OpsStatCard metric={dueToday} onSelect={() => onSelectMetric("dueToday")} />
        ) : null}
        <OpsStageBarsCard stages={stages} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((metric) => (
          <OpsMetricTile
            key={metric.id}
            metric={metric}
            onSelect={() => onSelectMetric(metric.id)}
          />
        ))}
      </div>
    </div>
  );
}
