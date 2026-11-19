import { MetricCards } from "@/kit";
import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";

const CLOSED = ["COMPLETED", "CLOSED", "CANCELLED", "STOPPED"];

/** Four headline numbers, as on the Task dashboard. */
export function ClientOverview({
  operations,
  exceptions,
}: {
  operations: OperationsDashboard;
  exceptions?: ExceptionsDashboard;
}) {
  const total = operations.summary.total;
  const share = (value: number) => (total ? Math.round((value / total) * 100) : 0);
  const completed = operations.statusMix["COMPLETED"] ?? 0;
  const active = Object.entries(operations.statusMix)
    .filter(([status]) => !CLOSED.includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const actions = exceptions?.summary.clientActions;
  const overdue = operations.summary.overdue;
  return (
    <MetricCards
      label="Portfolio summary"
      metrics={[
        {
          label: "All verifications",
          value: total,
          note: `${active} active`,
          to: "/client-portal/verifications",
        },
        {
          label: "Needs your action",
          value: actions ?? "—",
          note: actions ? "Open the requests" : "Nothing waiting on you",
          tone: "warn",
          progress: actions !== undefined ? share(actions) : undefined,
          to: "/client-portal/actions",
        },
        {
          label: "Completed",
          value: completed,
          note: `${share(completed)}% of all verifications`,
          tone: "good",
          progress: share(completed),
          to: "/client-portal/verifications",
          search: { status: "COMPLETED" },
        },
        {
          label: "Past turnaround",
          value: overdue,
          note: overdue ? "Your RM is following up" : "All on time",
          tone: "bad",
          progress: share(overdue),
          alarm: overdue > 0,
        },
      ]}
    />
  );
}
