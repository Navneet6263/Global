import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react";

import { DeliveryHeader, DeliveryKpis, DeliveryShell } from "@/features/delivery/DeliveryShell";
import { ExceptionQueue } from "@/features/delivery/exceptions/ExceptionQueue";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getExceptionsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/exceptions")({
  head: () => ({ meta: [{ title: "Exception Triage — Sapling Global" }] }),
  component: ExceptionsPage,
});

function ExceptionsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["dashboard", "exceptions"],
    queryFn: getExceptionsDashboard,
    refetchInterval: 30_000,
  });
  const data = query.data;
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["dashboard", "exceptions"] });
    await queryClient.invalidateQueries({ queryKey: ["field-visits"] });
  };
  return (
    <DeliveryShell onRefresh={() => void query.refetch()} refreshing={query.isFetching}>
      <DeliveryHeader
        eyebrow="Delivery / Control"
        title="Exception triage"
        description="One prioritised queue for SLA breaches, candidate clarifications and field exceptions—with action ownership kept visible."
        aside={
          data ? (
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {data.summary.total} exception events · {data.summary.uniqueCases} cases
            </span>
          ) : undefined
        }
      />
      {query.isLoading ? <WorkspaceLoading label="Building exception priority queue" /> : null}
      {query.isError ? (
        <WorkspaceError message={query.error.message} onRetry={() => void query.refetch()} />
      ) : null}
      {data ? (
        <>
          <DeliveryKpis
            items={[
              {
                label: "Affected cases",
                value: data.summary.uniqueCases,
                detail: `${data.summary.total} exception occurrences`,
                icon: Users,
                tone: "blue",
                progress: data.summary.uniqueCases ? 100 : 0,
              },
              {
                label: "Critical attention",
                value: data.summary.critical,
                detail: "Urgent SLA and geofence reviews",
                icon: AlertTriangle,
                tone: "red",
                progress: ratio(data.summary.critical, data.summary.total),
              },
              {
                label: "Average queue age",
                value: `${data.summary.averageAgeHours}h`,
                detail: "Across currently open exception events",
                icon: Clock3,
                tone: "amber",
                progress: Math.min(100, data.summary.averageAgeHours),
              },
              {
                label: "Resolved today",
                value: data.summary.resolvedToday,
                detail: "Clarification and field actions closed",
                icon: CheckCircle2,
                tone: "emerald",
                progress: ratio(
                  data.summary.resolvedToday,
                  data.summary.total + data.summary.resolvedToday,
                ),
              },
            ]}
          />
          <ExceptionQueue data={data} onRefresh={refresh} />
        </>
      ) : null}
    </DeliveryShell>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
