import { useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { OversightSearch } from "@/features/admin-dashboard/components/oversight-ui";
import { useSearchText } from "@/lib/use-search-text";
import { useVendorRequests } from "./use-vendor-requests";
import { vendorListView, type VendorListView } from "./vendor-request-model";
import type { VendorRequestsSearch } from "./vendor-search";
import { VendorRequestDrawer } from "./VendorRequestDrawer";
import { VendorRequestTable } from "./VendorRequestTable";

/** One sidebar status view (Pending, Approved, Rejected or All) of the caller's own requests. */
export function VendorRequestsView({
  view,
  search,
  onSearch,
}: {
  view: VendorListView;
  search: VendorRequestsSearch;
  onSearch: (patch: Partial<VendorRequestsSearch>) => void;
}) {
  const meta = vendorListView(view);
  const [text, setText] = useSearchText(
    search.search,
    useCallback((value?: string) => onSearch({ search: value, page: undefined }), [onSearch]),
  );
  const requests = useVendorRequests({
    status: meta.status,
    page: search.page ?? 1,
    pageSize: 20,
    search: search.search,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={meta.title} description={meta.description} />
      <VendorRequestTable
        title={meta.title}
        description="Open a request to see its document, decision and report."
        data={requests.data}
        error={requests.error}
        retrying={requests.isFetching}
        onRetry={() => void requests.refetch()}
        onPage={(page) => onSearch({ page })}
        onOpen={(row) => onSearch({ requestId: row.id })}
        toolbar={<OversightSearch value={text} onChange={setText} placeholder="Case number" />}
      />
      <VendorRequestDrawer
        requestId={search.requestId}
        onClose={() => onSearch({ requestId: undefined })}
      />
    </div>
  );
}
