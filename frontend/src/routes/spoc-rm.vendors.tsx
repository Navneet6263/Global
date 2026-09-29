import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import {
  SpocVendorClients,
  SpocVendorDocumentDrawer,
  SpocVendorDocuments,
  spocVendorsSearch,
  type SpocVendorsSearch,
} from "@/features/spoc-rm";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export const Route = createFileRoute("/spoc-rm/vendors")({
  validateSearch: spocVendorsSearch,
  head: () => ({ meta: [{ title: "SPOC-RM Vendors — Sapling Global" }] }),
  component: SpocVendorsPage,
});

const VENDOR_FILTERS = [
  ["", "All vendor statuses"],
  ["NOT_ASSIGNED", "Not assigned"],
  ["PENDING", "With vendor"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected — needs re-assignment"],
] as const;

function SpocVendorsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [text, setText] = useState(search.search ?? "");
  const debounced = useDebouncedValue(text.trim());
  const update = (patch: Partial<SpocVendorsSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });

  useEffect(() => {
    if (debounced !== (search.search ?? ""))
      void navigate({
        search: (current) => ({ ...current, search: debounced || undefined, page: undefined }),
        replace: true,
      });
  }, [debounced, navigate, search.search]);

  // Switching between the client list and one client's documents starts a fresh search.
  const openView = (clientId: string | undefined) => {
    setText("");
    update({ clientId, page: undefined, search: undefined, vendorStatus: undefined });
  };
  const query = { page: search.page ?? 1, pageSize: 20, search: search.search };

  return (
    <>
      <PageHeader
        title="Vendors"
        description="Assign uploaded client documents to vendors, follow their decisions and re-assign rejected ones."
      />
      {search.clientId ? (
        <SpocVendorDocuments
          clientId={search.clientId}
          query={{ ...query, vendorStatus: search.vendorStatus }}
          onBack={() => openView(undefined)}
          onPage={(page) => update({ page })}
          onOpen={(documentId) => update({ documentId })}
          toolbar={
            <>
              <OversightSearch
                value={text}
                onChange={setText}
                placeholder="Candidate or case number"
              />
              <select
                aria-label="Vendor status"
                className="h-9 rounded-full border border-border bg-card px-3 text-xs font-medium"
                value={search.vendorStatus ?? ""}
                onChange={(event) =>
                  update({
                    vendorStatus: (event.target.value ||
                      undefined) as SpocVendorsSearch["vendorStatus"],
                    page: undefined,
                  })
                }
              >
                {VENDOR_FILTERS.map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          }
        />
      ) : (
        <SpocVendorClients
          query={query}
          onPage={(page) => update({ page })}
          onOpen={(clientId) => openView(clientId)}
          toolbar={
            <OversightSearch value={text} onChange={setText} placeholder="Client name or code" />
          }
        />
      )}
      <SpocVendorDocumentDrawer
        documentId={search.documentId}
        onClose={() => update({ documentId: undefined })}
      />
    </>
  );
}
