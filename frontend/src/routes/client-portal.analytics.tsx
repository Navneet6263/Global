import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorText, Loading, MetricCards, Tabs } from "@/kit";
import { ClientDeepAnalytics } from "@/features/stakeholders/client/ClientDeepAnalytics";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientBranchComparison } from "@/features/stakeholders/client/ClientBranchComparison";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { caseStatusLabel, relativeTime } from "@/features/stakeholders/client/client-portal-utils";
import { getClientAnalyticsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal/analytics")({
  head: () => ({ meta: [{ title: "Portfolio Analytics — Sapling Global" }] }),
  component: ClientAnalyticsPage,
});

type InsightView = "flow" | "quality" | "branches";

const VIEWS = [
  ["flow", "Flow & outcomes"],
  ["quality", "Quality & rework"],
  ["branches", "Branch comparison"],
] as const;

function ClientAnalyticsPage() {
  const [view, setView] = useState<InsightView>("flow");
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
    <div className="flex min-w-0 flex-col gap-4">
      <ClientWorkspaceHeader
        title="Portfolio insights"
        description="Spot delays, understand quality and compare delivery branches."
      />
      {analytics.isError ? (
        <ErrorText onRetry={() => void analytics.refetch()} retrying={analytics.isFetching}>
          We couldn&apos;t load this data. {analytics.error.message}
        </ErrorText>
      ) : null}
      {analytics.isPending ? <Loading>Loading insights…</Loading> : null}
      {data ? (
        <>
          <MetricCards
            label="Page summary"
            metrics={[
              {
                label: "Non-clear outcomes",
                value: `${data.summary.nonClearRate}%`,
                progress: Math.round(data.summary.nonClearRate),
                tone: "warn",
                note: `${data.summary.nonClear} of ${data.summary.returnedOutcomes} returned checks`,
              },
              {
                label: "Rejected documents",
                value: data.summary.rejectedDocuments,
                alarm: data.summary.rejectedDocuments > 0,
                note: "Current document records",
              },
              {
                label: "QA rework",
                value: data.summary.qaRework,
                note: "Cases returned for correction",
              },
              {
                label: "Largest active stage",
                value: data.bottleneck?.count ?? 0,
                note: data.bottleneck ? caseStatusLabel(data.bottleneck.status) : "No active stage",
              },
            ]}
          />
          <Tabs
            label="Insight view"
            value={view}
            onChange={setView}
            tabs={VIEWS}
            aside={
              <span className="text-xs text-dim">
                Snapshot updated {relativeTime(data.generatedAt)}
              </span>
            }
          />
          <div className="flex min-w-0 flex-col gap-4">
            {view === "branches" ? (
              <ClientBranchComparison rows={data.branches ?? []} />
            ) : (
              <ClientDeepAnalytics data={data} view={view} />
            )}
            {view === "flow" ? (
              <>
                {operations.isPending ? <Loading>Loading monthly movement…</Loading> : null}
                {operations.isError ? (
                  <ErrorText
                    onRetry={() => void operations.refetch()}
                    retrying={operations.isFetching}
                  >
                    Movement data unavailable. {operations.error.message}
                  </ErrorText>
                ) : null}
                {operations.data ? <ClientInsights data={operations.data} /> : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
