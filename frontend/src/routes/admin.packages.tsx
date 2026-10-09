import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ClientPricingPanel } from "@/features/packages/ClientPricingPanel";
import { PackagesBoard } from "@/features/packages/PackagesBoard";

export const Route = createFileRoute("/admin/packages")({
  head: () => ({ meta: [{ title: "Packages & pricing — Sapling Global" }] }),
  component: AdminPackagesPage,
});

function AdminPackagesPage() {
  return (
    <>
      <PageHeader
        title="Packages & pricing"
        description="Build packages, set how much each RM may discount, and give client discounts. Every change is audited."
      />
      <div className="grid gap-4">
        <PackagesBoard />
        <ClientPricingPanel />
      </div>
    </>
  );
}
