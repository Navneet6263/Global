import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { OpsSummaryGrid } from "@/features/operations/components/ops-summary-grid";
import { OpsStageFlow } from "@/features/operations/components/ops-stage-flow";
import { OpsActionQueue } from "@/features/operations/components/ops-action-queue";
import { OperationsActionInbox } from "@/features/operations/actions/operations-action-inbox";
import { actionInboxSearch } from "@/features/operations/actions/action-inbox-model";
import type { OpsMetricId } from "@/features/operations/contracts/operations";
import {
  opsDashboardQueryOptions,
  useOpsDashboard,
} from "@/features/operations/hooks/use-operations";

export const Route = createFileRoute("/operations/")({
  validateSearch: actionInboxSearch,
  head: () => ({
    meta: [
      { title: "Operations Dashboard — Sapling Global" },
      {
        name: "description",
        content:
          "Live operations workload: unassigned checks, SLA risk, stage bottlenecks and today's action queue.",
      },
      { property: "og:title", content: "Operations Dashboard — Sapling Global" },
      {
        property: "og:description",
        content: "Workload, SLA risk and the action queue for verification delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(opsDashboardQueryOptions);
  },
  component: OperationsDashboard,
});

function OperationsDashboard() {
  const navigate = useNavigate();
  const { data, isPending, isError, isFetching, refetch } = useOpsDashboard();

  const openCase = (caseId: string) => {
    void navigate({ to: "/operations/cases", search: { caseId } });
  };

  const openMetric = (id: OpsMetricId) => {
    if (id === "clarifications") {
      void navigate({ to: "/operations/clarifications" });
      return;
    }
    void navigate({
      to: "/operations/cases",
      search:
        id === "unassigned"
          ? { unassigned: true }
          : id === "dueToday"
            ? { dueNext7Days: true }
            : id === "slaRisk"
              ? { sla: "overdue" }
              : {},
    });
  };

  return (
    <div className="space-y-6">
      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      {isPending ? (
        <>
          <CardGridSkeleton count={6} />
          <ListSkeleton rows={4} />
        </>
      ) : null}

      {data ? (
        <>
          <OpsSummaryGrid
            metrics={data.metrics}
            stages={data.stages}
            throughput={data.throughput}
            onSelectMetric={openMetric}
          />
        </>
      ) : null}
      <OperationsActionInbox />
      {data ? (
        <>
          <OpsStageFlow stages={data.stages} />
          <OpsActionQueue items={data.actions} onOpenCase={openCase} />
        </>
      ) : null}
    </div>
  );
}
