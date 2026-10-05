import { createFileRoute } from "@tanstack/react-router";
import { ClientSupportPage } from "@/features/stakeholders/client/ClientSupportPage";

export const Route = createFileRoute("/client-portal/support")({
  head: () => ({ meta: [{ title: "Queries & support — Sapling Global" }] }),
  component: ClientSupportPage,
});
