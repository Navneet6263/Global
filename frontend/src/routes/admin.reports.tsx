import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { ClientReportsLibrary } from "@/features/stakeholders/client/ClientReportsLibrary";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Released reports — Sapling Global" }] }),
  component: () => (
    <>
      <PageHeader
        title="Released reports"
        description="Search and download released verification reports. Pending generation, billing and release decisions remain in each case workspace."
      />
      <ClientReportsLibrary />
    </>
  ),
});
