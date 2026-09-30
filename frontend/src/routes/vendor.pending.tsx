import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { vendorRequestsSearch, type VendorRequestsSearch } from "@/features/vendor/vendor-search";
import { VendorRequestsView } from "@/features/vendor/VendorRequestsView";

export const Route = createFileRoute("/vendor/pending")({
  validateSearch: vendorRequestsSearch,
  head: () => ({ meta: [{ title: "Pending requests — Sapling Global" }] }),
  component: PendingRequestsPage,
});

function PendingRequestsPage() {
  const navigate = useNavigate({ from: Route.fullPath });
  const onSearch = useCallback(
    (patch: Partial<VendorRequestsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );
  return <VendorRequestsView view="PENDING" search={Route.useSearch()} onSearch={onSearch} />;
}
