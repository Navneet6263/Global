import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { SpocClientTable, spocClientsSearch } from "@/features/spoc-rm";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export const Route = createFileRoute("/spoc-rm/clients")({
  validateSearch: spocClientsSearch,
  head: () => ({ meta: [{ title: "SPOC-RM Clients — Sapling Global" }] }),
  component: SpocClientsPage,
});

function SpocClientsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [text, setText] = useState(search.search ?? "");
  const debounced = useDebouncedValue(text.trim());
  useEffect(() => {
    if (debounced !== (search.search ?? ""))
      void navigate({
        search: (current) => ({ ...current, search: debounced || undefined, page: undefined }),
        replace: true,
      });
  }, [debounced, navigate, search.search]);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Per-client progress, client-side pending work, overdue cases and receivables."
      />
      <SpocClientTable
        title="Client roll-up"
        description="Select a client to open its cases. Finance figures are unsettled invoices only."
        query={{
          page: search.page ?? 1,
          pageSize: 20,
          search: search.search,
          status: search.status,
        }}
        onPage={(page) =>
          void navigate({ search: (current) => ({ ...current, page }), replace: true })
        }
        toolbar={
          <>
            <OversightSearch value={text} onChange={setText} placeholder="Client name or code" />
            <select
              aria-label="Client status"
              className="h-9 rounded-full border border-border bg-card px-3 text-xs font-medium"
              value={search.status ?? ""}
              onChange={(event) =>
                void navigate({
                  search: (current) => ({
                    ...current,
                    status: (event.target.value || undefined) as typeof search.status,
                    page: undefined,
                  }),
                  replace: true,
                })
              }
            >
              <option value="">All statuses</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </>
        }
      />
    </>
  );
}
