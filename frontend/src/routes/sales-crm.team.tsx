"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSalesOwners } from "@/features/crm/hooks/use-crm";
import { CrmTeamGrid } from "@/features/crm/components/crm-team-grid";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton } from "@/components/feedback/skeletons";

export const Route = createFileRoute("/sales-crm/team")({
  head: () => ({
    meta: [
      { title: "Sales Team — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Territory-wise sales rep performance: pipeline, weighted forecast, win rate and overdue follow-ups.",
      },
      { property: "og:title", content: "Sales Team — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Compare rep load, conversion and activity levels across territories.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const navigate = useNavigate();
  const ownersQuery = useSalesOwners();

  return (
    <>
      <PageHeader
        title="Sales team"
        description="Rep-level load, conversion and follow-up discipline across territories."
      />
      {ownersQuery.data ? (
        <CrmTeamGrid
          owners={ownersQuery.data}
          onViewPipeline={(owner) =>
            void navigate({
              to: "/sales-crm/opportunities",
              search: { owner: owner.id, view: "board" },
            })
          }
        />
      ) : (
        <CardGridSkeleton count={6} />
      )}
    </>
  );
}
