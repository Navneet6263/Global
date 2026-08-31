"use client";

import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { CrmSettingsWorkspace } from "@/features/crm/components/crm-settings-workspace";

export const Route = createFileRoute("/sales-crm/settings")({
  head: () => ({
    meta: [
      { title: "CRM Settings — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Manage tenant pipeline probabilities and lead-source controls for the CRM workspace.",
      },
      { property: "og:title", content: "CRM Settings — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Secure, audited pipeline configuration for Sapling Global Sales & CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrmSettingsPage,
});

function CrmSettingsPage() {
  return (
    <>
      <PageHeader
        title="CRM settings"
        description="Pipeline weightings, source taxonomy and live workspace controls."
      />
      <CrmSettingsWorkspace />
    </>
  );
}
