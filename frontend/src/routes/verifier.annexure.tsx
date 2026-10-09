import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { TeamAnnexure } from "@/features/workflow-ui/TeamAnnexure";

export const Route = createFileRoute("/verifier/annexure")({
  head: () => ({ meta: [{ title: "Team annexure — Sapling Global" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Team annexure"
        description="Your team's closed checks this week, month or year, with colour codes."
      />
      <TeamAnnexure />
    </div>
  );
}
