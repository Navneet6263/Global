import { Link } from "@tanstack/react-router";
import { CircleCheck, Clock3, Files, Gauge, UserRoundPlus } from "lucide-react";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import type { NavigationCounts } from "./ops-workspace-api";
import type { OpsQueueView } from "./ops-queue-model";

export function OpsMetricsStrip({
  counts,
  dashboard,
  onTime,
}: {
  counts?: NavigationCounts;
  dashboard?: OperationsDashboard;
  onTime?: number | null;
}) {
  const value = (number?: number) => (number === undefined ? "—" : number.toLocaleString("en-IN"));
  const cards: Array<{
    label: string;
    value: string;
    icon: typeof Files;
    tone: string;
    view?: OpsQueueView;
    to?: "/operations/sla";
  }> = [
    { label: "Active cases", value: value(counts?.opsActiveCases), icon: Files, tone: "#1d4ed8" },
    {
      label: "Needs RM",
      value: value(counts?.opsUnassigned),
      icon: UserRoundPlus,
      tone: "#1d4ed8",
      view: "needs-rm",
    },
    {
      label: "Overdue",
      value: value(counts?.opsSlaRisk),
      icon: Clock3,
      tone: "#b91c1c",
      view: "overdue",
    },
    {
      label: "Completed today",
      value: value(dashboard?.summary.completedToday),
      icon: CircleCheck,
      tone: "#15803d",
      view: "completed",
    },
    {
      label: "On-time",
      value: onTime === undefined ? "—" : onTime === null ? "No data" : `${Math.round(onTime)}%`,
      icon: Gauge,
      tone:
        onTime === undefined || onTime === null || onTime >= 90
          ? "#15803d"
          : onTime >= 75
            ? "#b45309"
            : "#b91c1c",
      to: "/operations/sla",
    },
  ];
  return (
    <section className="client-panel client-metrics" aria-label="Operations summary">
      {cards.map(({ label, value: shown, icon: Icon, tone, view, to }) => (
        <Link
          key={label}
          to={to ?? "/operations"}
          search={to ? {} : { view }}
          className="client-metric"
          style={{ color: tone }}
        >
          <Icon aria-hidden />
          <div>
            <small>{label}</small>
            <strong className="num">{shown}</strong>
          </div>
        </Link>
      ))}
    </section>
  );
}
