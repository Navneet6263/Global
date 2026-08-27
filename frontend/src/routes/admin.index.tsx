import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { SummaryGrid } from "@/features/admin-dashboard/components/summary-grid";
import { PipelineBoard } from "@/features/admin-dashboard/components/pipeline-board";
import { ActionQueue } from "@/features/admin-dashboard/components/action-queue";
import { PlatformHealthPanel } from "@/features/admin-dashboard/components/platform-health-panel";
import { AdminCrmSummary } from "@/features/admin-dashboard/components/admin-crm-summary";
import { useCrmAdminSummary } from "@/features/crm/hooks/use-crm";
import {
  controlTowerQueryOptions,
  useControlTower,
} from "@/features/admin-dashboard/hooks/use-control-tower";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Control Tower — Sapling Global Platform Admin" },
      {
        name: "description",
        content:
          "Live verification portfolio, pipeline bottlenecks and the SLA action queue for Sapling Global operations.",
      },
      { property: "og:title", content: "Control Tower — Sapling Global" },
      {
        property: "og:description",
        content: "Live verification portfolio, pipeline health and SLA action queue.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(controlTowerQueryOptions);
  },
  component: ControlTowerPage,
});

function ControlTowerPage() {
  const navigate = useNavigate();
  const { data, isPending, isError, isFetching, refetch } = useControlTower();
  const crmSummary = useCrmAdminSummary();

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
          <SummaryGrid cards={data.summary} pipeline={data.pipeline} />
          <PipelineBoard stages={data.pipeline} />
          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <ActionQueue
              items={data.actions}
              onOpenCase={(caseId) => void navigate({ to: "/admin/cases", search: { caseId } })}
            />
            <PlatformHealthPanel />
          </div>
          {crmSummary.data ? <AdminCrmSummary summary={crmSummary.data} /> : null}
        </>
      ) : null}
    </div>
  );
}
