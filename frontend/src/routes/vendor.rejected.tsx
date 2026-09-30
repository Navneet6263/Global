import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { vendorRequestsSearch, type VendorRequestsSearch } from "@/features/vendor/vendor-search";
import { VendorRequestsView } from "@/features/vendor/VendorRequestsView";

export const Route = createFileRoute("/vendor/rejected")({
  validateSearch: vendorRequestsSearch,
  head: () => ({ meta: [{ title: "Rejected requests — Sapling Global" }] }),
  component: RejectedRequestsPage,
});

function RejectedRequestsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const onSearch = useCallback(
    (patch: Partial<VendorRequestsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  return <VendorRequestsView view="REJECTED" search={Route.useSearch()} onSearch={onSearch} />;
}
