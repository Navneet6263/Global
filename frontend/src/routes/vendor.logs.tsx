import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { VendorLogList } from "@/features/vendor/activity/VendorLogList";
import { vendorLogsSearch } from "@/features/vendor/vendor-search";

export const Route = createFileRoute("/vendor/logs")({
  validateSearch: vendorLogsSearch,
  head: () => ({ meta: [{ title: "Vendor logs — Sapling Global" }] }),
  component: VendorLogsPage,
});

function VendorLogsPage() {
  const { requestId } = Route.useSearch();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        description="What happened on your requests: who did it and when. Only your own vendor account is shown."
      />
      <VendorLogList requestId={requestId} />
    </div>
  );
}
