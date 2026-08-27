import { createFileRoute } from "@tanstack/react-router";
import { PlannedWorkspace } from "@/features/workspaces/components/planned-workspace";

export const Route = createFileRoute("/admin/qa")({
  head: () => ({
    meta: [
      { title: "QA Review — Sapling Global" },
      { name: "description", content: "Sampling, correction loops and report sign-off." },
      { property: "og:title", content: "QA Review — Sapling Global" },
      { property: "og:description", content: "Sampling, correction loops and report sign-off." },
    ],
  }),
  component: Page,
});

const SCOPE = [
  "Risk-weighted sampling of completed checks.",
  "Return-for-correction loop with reviewer notes.",
  "Sign-off gate before a report can be published.",
  "Reviewer scorecards and defect categories.",
];

function Page() {
  return (
    <PlannedWorkspace
      title="QA Review"
      description="Sampling, correction loops and report sign-off."
      role="QA_REVIEWER"
      permissions={["qa:read", "report:read"]}
      scope={SCOPE}
    />
  );
}
