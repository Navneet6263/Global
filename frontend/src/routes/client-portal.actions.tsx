import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ClientActionCenter } from "@/features/stakeholders/client/ClientActionCenter";
import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { getExceptionsDashboard } from "@/lib/api/dashboards";

interface ActionSearch {
  caseId?: string;
}

export const Route = createFileRoute("/client-portal/actions")({
  validateSearch: (search: Record<string, unknown>): ActionSearch => ({
    caseId: typeof search["caseId"] === "string" ? search["caseId"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Action Required — Sapling Global" }] }),
  component: ClientActionsPage,
});

function ClientActionsPage() {
  const routeSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(routeSearch.caseId);
  useEffect(() => {
    if (routeSearch.caseId) setSelectedCaseId(routeSearch.caseId);
  }, [routeSearch.caseId]);
  const actions = useQuery({
    queryKey: ["dashboard", "client", "actions"],
    queryFn: getExceptionsDashboard,
  });
  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    void navigate({ search: (current) => ({ ...current, caseId }) });
  };

  return (
    <>
      <ClientWorkspaceHeader
        title="Action required"
        description="Resolve document corrections and information requests before they affect verification turnaround."
      />
      {actions.isPending ? <ListSkeleton rows={6} /> : null}
      {actions.isError ? (
        <ErrorState
          description={actions.error.message}
          onRetry={() => void actions.refetch()}
          retrying={actions.isFetching}
        />
      ) : null}
      {actions.data ? <ClientActionCenter data={actions.data} onOpen={openCase} /> : null}
      {selectedCaseId ? (
        <ClientCaseDrawer
          caseId={selectedCaseId}
          canRespond
          onClose={() => {
            setSelectedCaseId(undefined);
            void navigate({
              search: (current) => ({ ...current, caseId: undefined }),
              replace: true,
            });
          }}
        />
      ) : null}
    </>
  );
}
