import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ClientActionCenter } from "@/features/stakeholders/client/ClientActionCenter";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { getExceptionsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal/actions")({
  validateSearch: (search: Record<string, unknown>): { caseId?: string } => ({
    caseId:
      typeof search["caseId"] === "string" && search["caseId"].length <= 64
        ? search["caseId"]
        : undefined,
  }),
  head: () => ({ meta: [{ title: "Action Required — Sapling Global" }] }),
  component: ClientActionsPage,
});

function ClientActionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const actions = useQuery({
    queryKey: ["dashboard", "client", "actions"],
    queryFn: getExceptionsDashboard,
  });
  return (
    <>
      <ClientWorkspaceHeader
        title="Needs your action"
        description="Resolve corrections and follow requests without losing case context."
      />
      {actions.isPending && <ListSkeleton rows={6} />}
      {actions.isError && (
        <ErrorState
          description={actions.error.message}
          onRetry={() => void actions.refetch()}
          retrying={actions.isFetching}
        />
      )}
      {actions.data && (
        <ClientActionCenter
          data={actions.data}
          onOpen={(caseId) => void navigate({ search: { caseId } })}
        />
      )}
      {search.caseId && (
        <ClientCaseDialog
          caseId={search.caseId}
          onClose={() => void navigate({ search: {}, replace: true })}
        />
      )}
    </>
  );
}
