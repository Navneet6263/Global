import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorText, Loading } from "@/kit";
import { ClientActionCenter } from "@/features/stakeholders/client/ClientActionCenter";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { getExceptionsDashboard } from "@/lib/api/dashboards";
import { parseCaseTab, type CaseTabName } from "@/features/stakeholders/client/client-queue-model";

export const Route = createFileRoute("/client-portal/actions")({
  validateSearch: (search: Record<string, unknown>): { caseId?: string; tab?: CaseTabName } => ({
    caseId:
      typeof search["caseId"] === "string" && search["caseId"].length <= 64
        ? search["caseId"]
        : undefined,
    tab: parseCaseTab(search["tab"]),
  }),
  head: () => ({ meta: [{ title: "Your to-do — Sapling Global" }] }),
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
        title="Your to-do"
        description="What needs you right now, most urgent first."
      />
      {actions.isPending && <Loading>Loading your action items…</Loading>}
      {actions.isError && (
        <ErrorText onRetry={() => void actions.refetch()} retrying={actions.isFetching}>
          {actions.error.message}
        </ErrorText>
      )}
      {actions.data && (
        <ClientActionCenter
          data={actions.data}
          onOpen={(caseId, tab) => void navigate({ search: { caseId, tab } })}
        />
      )}
      {search.caseId && (
        <ClientCaseDialog
          caseId={search.caseId}
          tab={search.tab}
          onClose={() => void navigate({ search: {}, replace: true })}
        />
      )}
    </>
  );
}
