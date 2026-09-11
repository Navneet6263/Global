import { createFileRoute } from "@tanstack/react-router";
import { ClientBilling } from "@/features/stakeholders/client/ClientBilling";

export const Route = createFileRoute("/client-portal/billing")({
  head: () => ({ meta: [{ title: "Invoices & payments — Sapling Global" }] }),
  component: ClientBilling,
});
