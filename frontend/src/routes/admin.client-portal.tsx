import { createFileRoute } from "@tanstack/react-router";
import { PlannedWorkspace } from "@/features/workspaces/components/planned-workspace";

export const Route = createFileRoute("/admin/client-portal")({
  head: () => ({
    meta: [
      { title: "Client Portal Preview — Sapling Global" },
      {
        name: "description",
        content: "See exactly what a client admin sees before you enable a workspace.",
      },
      { property: "og:title", content: "Client Portal Preview — Sapling Global" },
      {
        property: "og:description",
        content: "See exactly what a client admin sees before you enable a workspace.",
      },
    ],
  }),
  component: Page,
});

const SCOPE = [
  "Client-scoped case list with masked candidate data.",
  "Clarification inbox for client responses.",
  "Report download centre with retention rules applied.",
  "Bulk candidate upload and consent invitation tracking.",
];

function Page() {
  return (
    <PlannedWorkspace
      title="Client Portal Preview"
      description="See exactly what a client admin sees before you enable a workspace."
      role="CLIENT_ADMIN"
      permissions={["client:read", "case:read"]}
      scope={SCOPE}
    />
  );
}
