import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ClientDeepAnalytics } from "@/features/stakeholders/client/ClientDeepAnalytics";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientBranchComparison } from "@/features/stakeholders/client/ClientBranchComparison";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { ClientSummary } from "@/features/stakeholders/client/ClientPageParts";
import { caseStatusLabel, relativeTime } from "@/features/stakeholders/client/client-portal-utils";
import { getClientAnalyticsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal/analytics")({
  head: () => ({ meta: [{ title: "Portfolio Analytics — Sapling Global" }] }),
  component: ClientAnalyticsPage,
});

function ClientAnalyticsPage() {
  const [view, setView] = useState<"flow" | "quality" | "branches">("flow");
  const operations = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const analytics = useQuery({
    queryKey: ["dashboard", "client", "analytics"],
    queryFn: getClientAnalyticsDashboard,
  });
  const data = analytics.data;
  return (
    <>
      <ClientWorkspaceHeader
        title="Portfolio insights"
        description="Spot delays, understand quality and compare delivery branches."
      />
      {analytics.isError && (
        <ErrorState
          description={analytics.error.message}
          onRetry={() => void analytics.refetch()}
          retrying={analytics.isFetching}
        />
      )}
      {analytics.isPending && <ListSkeleton rows={4} />}
      {data && (
        <>
          <ClientSummary
            items={[
              {
                label: "Non-clear outcomes",
                value: `${data.summary.nonClearRate}%`,
                tone: "amber",
                detail: `${data.summary.nonClear} of ${data.summary.returnedOutcomes} returned checks`,
              },
              {
                label: "Rejected documents",
                value: data.summary.rejectedDocuments,
                tone: "red",
                detail: "Current document records",
              },
              {
                label: "QA rework",
                value: data.summary.qaRework,
                tone: "violet",
                detail: "Cases returned for correction",
              },
              {
                label: "Largest active stage",
                value: data.bottleneck?.count ?? 0,
                detail: data.bottleneck
                  ? caseStatusLabel(data.bottleneck.status)
                  : "No active stage",
              },
            ]}
          />
          <div className="client-view-toolbar">
            <div className="client-segments" role="group" aria-label="Insight view">
              {(
                [
                  ["flow", "Flow & outcomes"],
                  ["quality", "Quality & rework"],
                  ["branches", "Branch comparison"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} aria-pressed={view === value} onClick={() => setView(value)}>
                  {label}
                </button>
              ))}
            </div>
            <span className="client-muted">Snapshot updated {relativeTime(data.generatedAt)}</span>
          </div>
          <div className="client-insights-view">
            {view === "branches" ? (
              <ClientBranchComparison rows={data.branches ?? []} />
            ) : (
              <ClientDeepAnalytics data={data} view={view} />
            )}
            {view === "flow" && (
              <>
                {operations.isPending && <ListSkeleton rows={3} />}
                {operations.isError && (
                  <ErrorState
                    title="Movement data unavailable"
                    description={operations.error.message}
                    onRetry={() => void operations.refetch()}
                    retrying={operations.isFetching}
                  />
                )}
                {operations.data && <ClientInsights data={operations.data} />}
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
