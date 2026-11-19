import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ErrorText, Loading } from "@/kit";
import { ClientCaseDialog } from "@/features/stakeholders/client/ClientCaseDialog";
import { ClientOverview } from "@/features/stakeholders/client/ClientOverview";
import { ClientWorkflow } from "@/features/stakeholders/client/ClientWorkflow";
import { ClientCaseQueue } from "@/features/stakeholders/client/ClientCaseQueue";
import { ClientAttentionPanel } from "@/features/stakeholders/client/ClientAttentionPanel";
import { ClientHero } from "@/features/stakeholders/client/ClientHero";
import { ClientDoFirst } from "@/features/stakeholders/client/ClientDoFirst";
import {
  parseClientQueueSearch,
  type ClientQueueSearch,
} from "@/features/stakeholders/client/client-queue-model";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";
import { loadIdentity } from "@/lib/auth/platform-session";

export const Route = createFileRoute("/client-portal/")({
  validateSearch: parseClientQueueSearch,
  beforeLoad: async () => {
    // A self sign-up company starts on its onboarding checklist until it is approved.
    const identity = await loadIdentity();
    if (identity?.clientStatus === "ONBOARDING")
      throw redirect({ to: "/client-portal/onboarding" });
  },
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
    <div className="relative isolate flex flex-col gap-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 -z-10 sm:-inset-x-6 sm:-top-6 h-[620px] bg-[radial-gradient(900px_460px_at_70%_0%,var(--color-brand-soft),transparent_72%)]"
      />
      <ClientHero operations={dashboard.data} exceptions={exceptions.data} />
      <ClientDoFirst data={exceptions.data} onOpen={(caseId, tab) => update({ caseId, tab })} />
      {dashboard.isError ? (
        <ErrorText onRetry={() => void dashboard.refetch()} retrying={dashboard.isFetching}>
          {dashboard.error.message}
        </ErrorText>
      ) : null}
      {dashboard.isPending ? <Loading>Loading your overview…</Loading> : null}
      {dashboard.data ? (
        <ClientOverview operations={dashboard.data} exceptions={exceptions.data} />
      ) : null}
      {dashboard.data ? (
        <ClientWorkflow
          data={dashboard.data}
          selected={search.status}
          onSelect={(status) => update({ status, page: undefined })}
        />
      ) : null}
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
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
      {search.caseId ? (
        <ClientCaseDialog
          caseId={search.caseId}
          tab={search.tab}
          onClose={() => update({ caseId: undefined, tab: undefined }, true)}
        />
      ) : null}
    </div>
  );
}
