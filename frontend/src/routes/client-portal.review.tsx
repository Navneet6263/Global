import { createFileRoute } from "@tanstack/react-router";
import { ClientReviewPage } from "@/features/stakeholders/client/ClientReviewPage";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";

export const Route = createFileRoute("/client-portal/review")({
  head: () => ({ meta: [{ title: "Review submissions — Sapling Global" }] }),
  component: ClientReviewRoute,
});

function ClientReviewRoute() {
  return (
    <>
      <ClientWorkspaceHeader
        title="Review submissions"
        description="Approve your candidates' documents before Sapling starts verifying."
      />
      <ClientReviewPage />
    </>
  );
}
