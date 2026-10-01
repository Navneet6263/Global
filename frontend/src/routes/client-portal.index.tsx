import { useQuery } from "@tanstack/react-query";
import { CircleHelp } from "lucide-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientOverview } from "@/features/stakeholders/client/ClientOverview";
import { ClientWorkflow } from "@/features/stakeholders/client/ClientWorkflow";
import { ClientCaseQueue } from "@/features/stakeholders/client/ClientCaseQueue";
import { ClientAttentionPanel } from "@/features/stakeholders/client/ClientAttentionPanel";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import {
  parseClientQueueSearch,
  type ClientQueueSearch,
} from "@/features/stakeholders/client/client-queue-model";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal/")({
  validateSearch: parseClientQueueSearch,
  head: () => ({ meta: [{ title: "Client Portfolio — Sapling Global" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const dashboard = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const exceptions = useQuery({
    queryKey: ["dashboard", "client", "actions"],
    queryFn: getExceptionsDashboard,
  });
  const update = (patch: Partial<ClientQueueSearch>, replace = false) => {
    void navigate({ search: (current) => ({ ...current, ...patch }), replace });
  };
  const openCase = (caseId: string) => update({ caseId });

  return (
    <>
      <ClientWorkspaceHeader
        title="Verification overview"
        description="Track every candidate with clarity."
        allowCreate
        exportFilter={search}
      />
      {dashboard.isError ? (
        <ErrorState
          description={dashboard.error.message}
          onRetry={() => void dashboard.refetch()}
          retrying={dashboard.isFetching}
        />
      ) : null}
      {dashboard.isPending ? <CardGridSkeleton count={5} /> : null}
      {dashboard.data ? (
        <ClientOverview operations={dashboard.data} exceptions={exceptions.data} />
      ) : null}
      <div className="client-workspace-grid">
        <div className="client-workspace-main">
          {dashboard.data ? (
            <ClientWorkflow
              data={dashboard.data}
              selected={search.status}
              onSelect={(status) => update({ status, page: undefined })}
            />
          ) : null}
          <ClientCaseQueue
            search={search}
            counts={dashboard.data?.statusMix}
            onChange={update}
            onOpen={openCase}
          />
        </div>
        <ClientAttentionPanel
          data={exceptions.data}
          operations={dashboard.data}
          loading={exceptions.isPending}
          error={exceptions.error?.message}
          onRetry={() => void exceptions.refetch()}
          retrying={exceptions.isFetching}
        />
      </div>
      <p className="client-report-note">
        <CircleHelp className="size-3" aria-hidden />
        Reports are downloadable only after authorised release.
      </p>
      {search.caseId ? (
        <ClientCaseDialog
          caseId={search.caseId}
          onClose={() => update({ caseId: undefined }, true)}
        />
      ) : null}
    </>
  );
}
