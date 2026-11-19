import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientCaseQueue } from "@/features/stakeholders/client/ClientCaseQueue";
import { ClientExcelButton } from "@/features/stakeholders/client/ClientExcelButton";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import {
  parseClientQueueSearch,
  type ClientQueueSearch,
} from "@/features/stakeholders/client/client-queue-model";

export const Route = createFileRoute("/client-portal/verifications")({
  validateSearch: parseClientQueueSearch,
  head: () => ({ meta: [{ title: "Verifications — Sapling Global" }] }),
  component: ClientVerificationsPage,
});

function ClientVerificationsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = (patch: Partial<ClientQueueSearch>, replace = false) => {
    void navigate({ search: (current) => ({ ...current, ...patch }), replace });
  };
  return (
    <>
      <ClientWorkspaceHeader
        title="All candidates"
        description="Search every candidate, see the current stage and download it all to Excel."
        actions={<ClientExcelButton filters={{ q: search.q, status: search.status }} />}
        allowCreate
      />
      <ClientCaseQueue search={search} onChange={update} onOpen={(caseId) => update({ caseId })} />
      {search.caseId ? (
        <ClientCaseDialog
          caseId={search.caseId}
          tab={search.tab}
          onClose={() => update({ caseId: undefined, tab: undefined }, true)}
        />
      ) : null}
    </>
  );
}
