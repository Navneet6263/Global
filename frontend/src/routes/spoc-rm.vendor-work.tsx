import { createFileRoute } from "@tanstack/react-router";
import { InternalVendorWork } from "@/features/vendor-checks/InternalVendorWork";

export const Route = createFileRoute("/spoc-rm/vendor-work")({
  head: () => ({ meta: [{ title: "Vendor work — Sapling Global" }] }),
  validateSearch: (input: Record<string, unknown>): { status?: "PENDING_APPROVAL" } =>
    input["status"] === "PENDING_APPROVAL" ? { status: "PENDING_APPROVAL" } : {},
  component: VendorWorkPage,
});

function VendorWorkPage() {
  const { status } = Route.useSearch();
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Vendor work</h1>
          <p>Checks of your cases sent to vendors: ageing, overdue and results to review.</p>
        </div>
      </header>
      <InternalVendorWork initialStatus={status} storageKey="rm-vendor-work-columns" />
    </>
  );
}
