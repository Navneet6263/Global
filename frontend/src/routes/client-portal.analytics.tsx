import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { ClientDeepAnalytics } from "@/features/stakeholders/client/ClientDeepAnalytics";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientBranchComparison } from "@/features/stakeholders/client/ClientBranchComparison";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { getClientAnalyticsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal/analytics")({
  head: () => ({ meta: [{ title: "Portfolio Analytics — Sapling Global" }] }),
  component: ClientAnalyticsPage,
});

function ClientAnalyticsPage() {
  const operations = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const analytics = useQuery({
    queryKey: ["dashboard", "client", "analytics"],
    queryFn: getClientAnalyticsDashboard,
  });
  const error = operations.error ?? analytics.error;

  return (
    <>
      <ClientWorkspaceHeader
        title="Portfolio analytics"
        description="Understand stage ageing, non-clear outcomes, document quality and the exact areas causing rework."
      />
      {operations.isPending || analytics.isPending ? (
        <div className="space-y-5">
          <CardGridSkeleton count={4} />
          <ListSkeleton rows={5} />
        </div>
      ) : null}
      {error ? (
        <ErrorState
          description={error.message}
          onRetry={() => {
            void operations.refetch();
            void analytics.refetch();
          }}
          retrying={operations.isFetching || analytics.isFetching}
        />
      ) : null}
      {operations.data && analytics.data ? (
        <div className="space-y-5">
          <ClientDeepAnalytics data={analytics.data} />
          <ClientBranchComparison rows={analytics.data.branches ?? []} />
          <ClientInsights data={operations.data} />
        </div>
      ) : null}
    </>
  );
}
