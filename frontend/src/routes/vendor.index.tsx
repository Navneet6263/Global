import { useCallback } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { useVendorRequests } from "@/features/vendor/use-vendor-requests";
import { VendorKpiStrip } from "@/features/vendor/VendorKpiStrip";
import { vendorRequestsSearch, type VendorRequestsSearch } from "@/features/vendor/vendor-search";
import { VendorRequestDrawer } from "@/features/vendor/VendorRequestDrawer";
import { VendorRequestTable } from "@/features/vendor/VendorRequestTable";

export const Route = createFileRoute("/vendor/")({
  validateSearch: vendorRequestsSearch,
  head: () => ({ meta: [{ title: "Vendor requests — Sapling Global" }] }),
  component: VendorOverviewPage,
});

/** Counts per status and the latest requests; the sidebar opens each full list. */
function VendorOverviewPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = useCallback(
    (patch: Partial<VendorRequestsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  const latest = useVendorRequests({ page: 1, pageSize: 10 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor requests"
        description="Documents assigned to you. Approve them, or reject them with a clear reason."
      />
      <VendorKpiStrip counts={latest.data?.counts} />
      <VendorRequestTable
        title="Latest requests"
        description="The ten most recent assignments. Use the sidebar for every request by status."
        data={latest.data}
        error={latest.error}
        retrying={latest.isFetching}
        onRetry={() => void latest.refetch()}
        onOpen={(row) => update({ requestId: row.id })}
        toolbar={
          <Link
            to="/vendor/all"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View all <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <VendorRequestDrawer
        requestId={search.requestId}
        onClose={() => update({ requestId: undefined })}
      />
    </div>
  );
}
