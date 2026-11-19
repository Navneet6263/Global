import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientExcelButton } from "@/features/stakeholders/client/ClientExcelButton";
import { ClientPipelineBoard } from "@/features/stakeholders/client/ClientPipelineBoard";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { parseCaseTab, type CaseTabName } from "@/features/stakeholders/client/client-queue-model";

export const Route = createFileRoute("/client-portal/pipeline")({
  validateSearch: (search: Record<string, unknown>): { caseId?: string; tab?: CaseTabName } => ({
    caseId:
      typeof search["caseId"] === "string" && search["caseId"].length <= 64
        ? search["caseId"]
        : undefined,
    tab: parseCaseTab(search["tab"]),
  }),
  head: () => ({ meta: [{ title: "Pipeline — Sapling Global" }] }),
  component: ClientPipelinePage,
});

function ClientPipelinePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <>
      <ClientWorkspaceHeader
        title="Pipeline"
        description="Every case by stage. See at a glance where work is waiting."
        actions={<ClientExcelButton />}
      />
      <ClientPipelineBoard onOpen={(caseId) => void navigate({ search: { caseId } })} />
      {search.caseId ? (
        <ClientCaseDialog
          caseId={search.caseId}
          tab={search.tab}
          onClose={() => void navigate({ search: {}, replace: true })}
        />
      ) : null}
    </>
  );
}
