import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ClientPricingPanel } from "@/features/packages/ClientPricingPanel";

export const Route = createFileRoute("/spoc-rm/pricing")({
  validateSearch: (input: Record<string, unknown>): { client?: string } =>
    typeof input["client"] === "string" ? { client: input["client"] } : {},
  head: () => ({ meta: [{ title: "Client pricing — Sapling Global" }] }),
  component: SpocPricingPage,
});

function SpocPricingPage() {
  const { client } = Route.useSearch();
  return (
    <>
      <PageHeader
        title="Client pricing"
        description="Give your clients a discount on a package, up to the limit Operations set."
      />
      <ClientPricingPanel initialClientId={client} />
    </>
  );
}
