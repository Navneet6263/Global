"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { AdminCrmSummary } from "@/features/admin-dashboard/components/admin-crm-summary";
import { CrmTrendCard } from "@/features/crm/components/crm-trend-card";
import { crmAdminSummaryQueryOptions, useCrmAdminSummary } from "@/features/crm/hooks/use-crm";
import { PageHeader } from "@/components/layout/page-header";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { ErrorState } from "@/components/feedback/error-state";

export const Route = createFileRoute("/admin/sales")({
  head: () => ({
    meta: [
      { title: "Sales & CRM Oversight — Sapling Global Platform Admin" },
      {
        name: "description",
        content:
          "Read-only revenue oversight for platform admins: pipeline value, weighted forecast and follow-up backlog.",
      },
      { property: "og:title", content: "Sales & CRM Oversight — Sapling Global" },
      {
        property: "og:description",
        content: "Compact CRM signals for platform admins; deal execution stays with sales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(crmAdminSummaryQueryOptions),
  component: AdminSalesOversightPage,
});

function AdminSalesOversightPage() {
  const summaryQuery = useCrmAdminSummary();

  return (
    <>
      <PageHeader
        title="Sales & CRM oversight"
        description="Revenue signals only. Opportunity records, stage changes and follow-up actions live in the Sales & CRM workspace."
        actions={
          <Link
            to="/sales-crm"
            className="inline-flex items-center gap-1.5 rounded-full bg-mint-soft px-3.5 py-2 text-[12px] font-medium text-mint-deep transition-colors hover:bg-mint/15"
          >
            Open Sales &amp; CRM workspace
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        }
      />

      {summaryQuery.isError ? (
        <ErrorState title="CRM oversight unavailable" onRetry={() => void summaryQuery.refetch()} />
      ) : summaryQuery.data ? (
        <div className="space-y-5">
          <AdminCrmSummary summary={summaryQuery.data} showHeader={false} />
          <CrmTrendCard trend={summaryQuery.data.trend} />
        </div>
      ) : (
        <CardGridSkeleton count={4} />
      )}
    </>
  );
}
