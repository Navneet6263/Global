import { createFileRoute } from "@tanstack/react-router";
import { PlannedWorkspace } from "@/features/workspaces/components/planned-workspace";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance & Billing — Sapling Global" },
      { name: "description", content: "Invoices, collections and package pricing governance." },
      { property: "og:title", content: "Finance & Billing — Sapling Global" },
      {
        property: "og:description",
        content: "Invoices, collections and package pricing governance.",
      },
    ],
  }),
  component: Page,
});

const SCOPE = [
  "Invoice register with GST treatment and payment terms.",
  "Collections ageing buckets and dunning workflow.",
  "Per-client and per-package revenue recognition.",
  "Credit notes and dispute handling with audit trail.",
];

function Page() {
  return (
    <PlannedWorkspace
      title="Finance & Billing"
      description="Invoices, collections and package pricing governance."
      role="FINANCE_MANAGER"
      permissions={["finance:read", "client:read"]}
      scope={SCOPE}
    />
  );
}
