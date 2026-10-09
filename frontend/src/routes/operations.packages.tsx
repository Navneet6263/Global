import { createFileRoute } from "@tanstack/react-router";
import { ClientPricingPanel } from "@/features/packages/ClientPricingPanel";
import { PackagesBoard } from "@/features/packages/PackagesBoard";

export const Route = createFileRoute("/operations/packages")({
  head: () => ({ meta: [{ title: "Packages & pricing — Sapling Global Operations" }] }),
  component: OpsPackagesPage,
});

function OpsPackagesPage() {
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Packages & pricing</h1>
          <p>Build packages, set how much each RM may discount, and give client discounts.</p>
        </div>
      </header>
      <div className="grid gap-4">
        <PackagesBoard />
        <ClientPricingPanel />
      </div>
    </>
  );
}
