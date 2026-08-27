import { createFileRoute } from "@tanstack/react-router";
import { PlannedWorkspace } from "@/features/workspaces/components/planned-workspace";

export const Route = createFileRoute("/admin/field")({
  head: () => ({
    meta: [
      { title: "Field Operations — Sapling Global" },
      { name: "description", content: "Visit scheduling, GPS evidence and field exceptions." },
      { property: "og:title", content: "Field Operations — Sapling Global" },
      {
        property: "og:description",
        content: "Visit scheduling, GPS evidence and field exceptions.",
      },
    ],
  }),
  component: Page,
});

const SCOPE = [
  "Day plan and route optimisation per field executive.",
  "GPS-fenced check-in with photo evidence policy.",
  "Locked-premises and address-not-found exception capture.",
  "Cost and travel reimbursement summary per visit.",
];

function Page() {
  return (
    <PlannedWorkspace
      title="Field Operations"
      description="Visit scheduling, GPS evidence and field exceptions."
      role="FIELD_EXECUTIVE"
      permissions={["field:read", "case:read"]}
      scope={SCOPE}
    />
  );
}
