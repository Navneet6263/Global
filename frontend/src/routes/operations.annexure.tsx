import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { TeamAnnexure } from "@/features/workflow-ui/TeamAnnexure";

export const Route = createFileRoute("/operations/annexure")({
  head: () => ({ meta: [{ title: "Team annexure — Sapling Global" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Team annexure"
        description="Weekly, monthly and yearly closed checks with colour codes; send any back for rework."
      />
      <TeamAnnexure />
    </div>
  );
}
