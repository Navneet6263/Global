import { createFileRoute } from "@tanstack/react-router";
import { PlannedWorkspace } from "@/features/workspaces/components/planned-workspace";

export const Route = createFileRoute("/admin/verifier")({
  head: () => ({
    meta: [
      { title: "Verifier Operations — Sapling Global" },
      {
        name: "description",
        content: "Allocation rules, verifier load and check execution queues.",
      },
      { property: "og:title", content: "Verifier Operations — Sapling Global" },
      {
        property: "og:description",
        content: "Allocation rules, verifier load and check execution queues.",
      },
    ],
  }),
  component: Page,
});

const SCOPE = [
  "Skill and branch based allocation with capacity ceilings.",
  "Per-verifier queue, ageing and first-pass accuracy.",
  "Check execution console with evidence attachment.",
  "Reassignment and escalation with reason capture.",
];

function Page() {
  return (
    <PlannedWorkspace
      title="Verifier Operations"
      description="Allocation rules, verifier load and check execution queues."
      role="VERIFIER"
      permissions={["case:read", "case:assign"]}
      scope={SCOPE}
    />
  );
}
