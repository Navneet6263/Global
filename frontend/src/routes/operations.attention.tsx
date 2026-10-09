import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { OpsActionQueue } from "@/features/operations/components/ops-action-queue";
import { OperationsActionInbox } from "@/features/operations/actions/operations-action-inbox";
import { FlowPipelinePanel } from "@/features/operations/actions/FlowPipelinePanel";
import { AttentionFocus } from "@/features/operations/actions/AttentionFocus";
import { actionInboxSearch } from "@/features/operations/actions/action-inbox-model";
import {
  opsDashboardQueryOptions,
  useOpsDashboard,
} from "@/features/operations/hooks/use-operations";

export const Route = createFileRoute("/operations/attention")({
  validateSearch: actionInboxSearch,
  head: () => ({
    meta: [
      { title: "Needs attention — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Live operations workload: unassigned checks, SLA risk, stage bottlenecks and today's action queue.",
      },
      { property: "og:title", content: "Needs attention — Sapling Global Operations" },
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
  component: OperationsAttention,
});

function OperationsAttention() {
  const navigate = useNavigate();
  const { data, isPending, isError, isFetching, refetch } = useOpsDashboard();

  const openCase = (caseId: string) => {
    void navigate({ to: "/operations/cases", search: { caseId } });
  };

  return (
    <div className="attn">
      <header className="attn-head">
        <div>
          <h1>Needs attention</h1>
          <p>What to clear first, where cases are waiting, and the work queued for your team.</p>
        </div>
        <span className="attn-live">
          <i aria-hidden /> Live
        </span>
      </header>
      <AttentionFocus />
      <OperationsActionInbox />
      <FlowPipelinePanel />
      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}
      {isPending ? <ListSkeleton rows={4} /> : null}
      {data ? <OpsActionQueue items={data.actions} onOpenCase={openCase} /> : null}
    </div>
  );
}
