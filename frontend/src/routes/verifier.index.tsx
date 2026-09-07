import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";

import { WorkspaceIntro, WorkspaceMetricGrid } from "@/features/delivery/shared/WorkspaceIntro";
import { VerifierOverviewPanels } from "@/features/delivery/verifier/VerifierOverviewPanels";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { getMyTasks, getVerifierInsights } from "@/lib/api/tasks";

export const Route = createFileRoute("/verifier/")({
  head: () => ({ meta: [{ title: "Verifier Overview — Sapling Global" }] }),
  component: VerifierOverview,
});

function VerifierOverview() {
  const insights = useQuery({
    queryKey: ["verifier", "insights"],
    queryFn: getVerifierInsights,
    staleTime: 20_000,
  });
  const focus = useQuery({
    queryKey: ["tasks", "mine", "overview-focus"],
    queryFn: () => getMyTasks({ view: "ACTIVE", limit: 8 }),
    staleTime: 20_000,
  });
  if (insights.isLoading || focus.isLoading)
    return <WorkspaceLoading label="Preparing your verification desk" />;
  if (insights.isError || focus.isError) {
    const error = insights.error ?? focus.error;
    return (
      <WorkspaceError
        message={error?.message ?? "Verifier overview failed"}
        onRetry={() => void Promise.all([insights.refetch(), focus.refetch()])}
      />
    );
  }
  if (!insights.data) return null;
  const summary = insights.data.summary;
  return (
    <div className="space-y-6">
      <WorkspaceIntro
        eyebrow="Delivery · Verifier desk"
        title="Verifier overview"
        description="Your live workload, deadline pressure and evidence-backed completion performance in one focused view."
        signal={`${summary.active} active checks`}
      />
      <WorkspaceMetricGrid
        items={[
          {
            label: "Active workload",
            value: summary.active,
            detail: `${summary.inProgress} currently in progress`,
            icon: ClipboardCheck,
            tone: "mint",
          },
          {
            label: "Due in 24 hours",
            value: summary.dueNext24h,
            detail: `${summary.overdue} already overdue`,
            icon: Clock3,
            tone: summary.overdue ? "red" : "amber",
            share: ratio(summary.dueNext24h, summary.active),
          },
          {
            label: "Blocked",
            value: summary.blocked,
            detail: "Waiting on a source or dependency",
            icon: Ban,
            tone: summary.blocked ? "amber" : "mint",
            share: ratio(summary.blocked, summary.active),
          },
          {
            label: "Completed today",
            value: summary.completedToday,
            detail:
              summary.slaHitRate === null
                ? "No completed SLA sample this week"
                : `${summary.slaHitRate}% weekly SLA hit rate`,
            icon: CheckCircle2,
            tone: "blue",
            share: summary.slaHitRate ?? undefined,
          },
        ]}
      />
      <VerifierOverviewPanels insights={insights.data} focus={focus.data?.items ?? []} />
    </div>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
