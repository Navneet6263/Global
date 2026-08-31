import { createFileRoute } from "@tanstack/react-router";

import { ClientReportsLibrary } from "@/features/stakeholders/client/ClientReportsLibrary";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";

export const Route = createFileRoute("/client-portal/reports")({
  head: () => ({ meta: [{ title: "Reports — Sapling Global" }] }),
  component: ClientReportsPage,
});

function ClientReportsPage() {
  return (
    <>
      <ClientWorkspaceHeader
        title="Reports"
        description="Download signed results and verify each published report through its authenticity code."
      />
      <ClientReportsLibrary />
    </>
  );
}
