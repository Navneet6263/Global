import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KpiStrip } from "@/components/dashboards/ui";
import { PageHeader } from "@/components/layout/page-header";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { CLIENT_COLUMNS } from "@/features/support/components/support-columns";
import { SupportTablePanel } from "@/features/support/components/SupportTablePanel";
import { useSearchText } from "@/features/support/hooks/use-search-text";
import { useSupportClients, useSupportSummary } from "@/features/support/hooks/use-support";
import { supportClientsSearch, type SupportClientsSearch } from "@/features/support/support-search";

export const Route = createFileRoute("/support/")({
  validateSearch: supportClientsSearch,
  head: () => ({ meta: [{ title: "Support desk — Sapling Global" }] }),
  component: SupportClientsPage,
});

function SupportClientsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = useCallback(
    (patch: Partial<SupportClientsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  const [text, setText] = useSearchText(
    search.search,
    useCallback((value?: string) => update({ search: value, page: undefined }), [update]),
  );
  const summary = useSupportSummary();
  const clients = useSupportClients({
    page: search.page ?? 1,
    pageSize: 20,
    search: search.search,
  });
  const value = (count: number | undefined) => (count === undefined ? "—" : String(count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Every client's employees, progress and exceptions. Open a client to see its employees."
      />
      <KpiStrip
        items={[
          { label: "Clients", value: value(summary.data?.clients), delta: "All", tone: "info" },
          {
            label: "Employees in progress",
            value: value(summary.data?.activeEmployees),
            delta: "Active",
            tone: "success",
          },
          {
            label: "Need attention",
            value: value(summary.data?.exceptions),
            delta: "Exceptions",
            tone: "destructive",
          },
          {
            label: "Open requests",
            value: value(summary.data?.openRequests),
            delta: "Inbox",
            tone: "warning",
          },
        ]}
      />
      <SupportTablePanel
        title="Clients"
        description="Counts come from the live cases of each client."
        toolbar={
          <OversightSearch value={text} onChange={setText} placeholder="Client name or code" />
        }
        data={clients.data}
        error={clients.error}
        retrying={clients.isFetching}
        onRetry={() => void clients.refetch()}
        columns={CLIENT_COLUMNS}
        onOpen={(row) => void navigate({ to: "/support/employees", search: { clientId: row.id } })}
        openLabel={(row) => `Open ${row.displayName} employees`}
        onPage={(page) => update({ page })}
        emptyTitle="No clients found"
        emptyDetail="Try a different name or code."
      />
    </div>
  );
}
