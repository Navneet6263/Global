import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { SharedL1ClarificationsPanel } from "@/features/clarifications/SharedL1ClarificationsPanel";
import { SharedL2ClarificationsPanel } from "@/features/clarifications/SharedL2ClarificationsPanel";

export const Route = createFileRoute("/operations/clarifications")({
  head: () => ({
    meta: [
      { title: "Clarifications — Sapling Global Operations" },
      {
        name: "description",
        content: "Track candidate and client clarification threads and resolve received responses.",
      },
      {
        property: "og:title",
        content: "Clarifications — Sapling Global Operations",
      },
      {
        property: "og:description",
        content: "Every clarification thread with due dates and valid resolution actions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClarificationsPage,
});

function ClarificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clarifications"
        description="Track pending responses, review received information and close valid threads."
      />
      <SharedL2ClarificationsPanel mode="ops" />
      <SharedL1ClarificationsPanel mode="ops" />
    </div>
  );
}
