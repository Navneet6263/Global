import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { ClientOverview } from "@/features/stakeholders/client/ClientOverview";
import { ClientRecentCases } from "@/features/stakeholders/client/ClientRecentCases";
import { ClientWorkflow } from "@/features/stakeholders/client/ClientWorkflow";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

interface ClientPortalSearch {
  caseId?: string;
}

export const Route = createFileRoute("/client-portal/")({
  validateSearch: (search: Record<string, unknown>): ClientPortalSearch => ({
    caseId: typeof search["caseId"] === "string" ? search["caseId"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Client Portfolio — Sapling Global" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const routeSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(routeSearch.caseId);

  useEffect(() => {
    if (routeSearch.caseId) setSelectedCaseId(routeSearch.caseId);
  }, [routeSearch.caseId]);

  const dashboard = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const exceptions = useQuery({
    queryKey: ["dashboard", "client", "actions"],
    queryFn: getExceptionsDashboard,
  });
  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    void navigate({ search: (current) => ({ ...current, caseId }) });
  };
  const closeCase = () => {
    setSelectedCaseId(undefined);
    void navigate({ search: (current) => ({ ...current, caseId: undefined }), replace: true });
  };
  const hasError = dashboard.isError || exceptions.isError;

  return (
    <>
      <ClientWorkspaceHeader
        title="Portfolio overview"
        description="Monitor live volume, turnaround health and workflow movement across your organisation."
        allowCreate
      />
      {hasError ? (
        <ErrorState
          description={dashboard.error?.message ?? exceptions.error?.message}
          onRetry={() => {
            void dashboard.refetch();
            void exceptions.refetch();
          }}
          retrying={dashboard.isFetching || exceptions.isFetching}
        />
      ) : null}
      {dashboard.isPending || exceptions.isPending ? (
        <div className="space-y-5" aria-label="Loading client portfolio overview">
          <CardGridSkeleton count={4} />
          <ListSkeleton rows={5} />
        </div>
      ) : dashboard.data && exceptions.data ? (
        <div className="space-y-5">
          <ClientOverview operations={dashboard.data} exceptions={exceptions.data} />
          <ClientWorkflow data={dashboard.data} />
          <ClientRecentCases items={dashboard.data.recentCases} onOpen={openCase} />
        </div>
      ) : null}
      {selectedCaseId ? (
        <ClientCaseDrawer caseId={selectedCaseId} canRespond onClose={closeCase} />
      ) : null}
    </>
  );
}
