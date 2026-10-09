import { createFileRoute } from "@tanstack/react-router";
import { InternalVendorWork } from "@/features/vendor-checks/InternalVendorWork";

export const Route = createFileRoute("/operations/vendor-work")({
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
          <p>Checks sent to vendors: ageing, overdue and results waiting for your review.</p>
        </div>
      </header>
      <InternalVendorWork initialStatus={status} storageKey="operations-vendor-work-columns" />
    </>
  );
}
