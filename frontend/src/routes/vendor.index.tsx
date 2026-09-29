import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KpiStrip } from "@/components/dashboards/ui";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { useVendorRequests } from "@/features/vendor/use-vendor-requests";
import { REQUEST_TABS } from "@/features/vendor/vendor-request-model";
import { vendorRequestsSearch, type VendorRequestsSearch } from "@/features/vendor/vendor-search";
import { VendorRequestDrawer } from "@/features/vendor/VendorRequestDrawer";
import { VendorRequestTable } from "@/features/vendor/VendorRequestTable";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export const Route = createFileRoute("/vendor/")({
  validateSearch: vendorRequestsSearch,
  head: () => ({ meta: [{ title: "Vendor requests — Sapling Global" }] }),
  component: VendorRequestsPage,
});

function VendorRequestsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [text, setText] = useState(search.search ?? "");
  const debounced = useDebouncedValue(text.trim());
  const tab = search.status ?? "PENDING";
  const update = (patch: Partial<VendorRequestsSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });

  useEffect(() => {
    if (debounced !== (search.search ?? ""))
      void navigate({
        search: (current) => ({ ...current, search: debounced || undefined, page: undefined }),
        replace: true,
      });
  }, [debounced, navigate, search.search]);

  const requests = useVendorRequests({
    status: tab === "ALL" ? undefined : tab,
    page: search.page ?? 1,
    pageSize: 20,
    search: search.search,
  });
  const counts = requests.data?.counts;
  const value = (count: number | undefined) => (count === undefined ? "—" : String(count));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor requests"
        description="Documents assigned to you. Approve them, or reject them with a clear reason."
      />
      <KpiStrip
        items={[
          {
            label: "Waiting for you",
            value: value(counts?.pending),
            delta: "Pending",
            tone: "warning",
          },
          { label: "Approved", value: value(counts?.approved), delta: "Done", tone: "success" },
          {
            label: "Rejected",
            value: value(counts?.rejected),
            delta: "Sent back",
            tone: "destructive",
          },
        ]}
      />
      <Tabs
        value={tab}
        onValueChange={(next) =>
          update({ status: next as VendorRequestsSearch["status"], page: undefined })
        }
      >
        <TabsList>
          {REQUEST_TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value} className="text-xs">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <VendorRequestTable
        data={requests.data}
        error={requests.error}
        retrying={requests.isFetching}
        onRetry={() => void requests.refetch()}
        onPage={(page) => update({ page })}
        onOpen={(row) => update({ requestId: row.id })}
        toolbar={<OversightSearch value={text} onChange={setText} placeholder="Case number" />}
      />
      <VendorRequestDrawer
        requestId={search.requestId}
        onClose={() => update({ requestId: undefined })}
      />
    </div>
  );
}
