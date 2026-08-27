"use client";

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import type { FollowUp } from "@/features/crm/contracts/crm";
import {
  crmOverviewQueryOptions,
  useCompleteFollowUp,
  useCreateOpportunity,
  useCrmOverview,
  useRescheduleFollowUp,
  useSalesOwners,
} from "@/features/crm/hooks/use-crm";
import { CrmOverviewGrid } from "@/features/crm/components/crm-overview-grid";
import { CrmOpportunityForm } from "@/features/crm/components/crm-opportunity-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { ErrorState } from "@/components/feedback/error-state";
import { sessionForNav } from "@/lib/auth/session";
import { can } from "@/lib/permissions";

export const Route = createFileRoute("/sales-crm/")({
  head: () => ({
    meta: [
      { title: "Revenue Command — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Open pipeline, weighted forecast, win rate and today's follow-up priorities for the Sapling Global sales desk.",
      },
      { property: "og:title", content: "Revenue Command — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Pipeline value, forecast and follow-up priorities in one revenue command view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(crmOverviewQueryOptions),
  component: RevenueCommandPage,
});

function RevenueCommandPage() {
  const navigate = useNavigate();
  const session = sessionForNav("sales-crm");
  const canWrite = can(session, "crm:write");
  const overviewQuery = useCrmOverview();
  const ownersQuery = useSalesOwners();
  const createOpportunity = useCreateOpportunity();
  const completeFollowUp = useCompleteFollowUp();
  const rescheduleFollowUp = useRescheduleFollowUp();
  const [createOpen, setCreateOpen] = useState(false);

  const openOpportunity = (followUp: FollowUp) =>
    void navigate({
      to: "/sales-crm/opportunities",
      search: { opportunityId: followUp.opportunityId, view: "table" },
    });

  return (
    <>
      <PageHeader
        title="Revenue command"
        description="Pipeline health, forecast confidence and the next actions that move revenue today."
        actions={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New opportunity
            </Button>
          ) : null
        }
      />

      {overviewQuery.isError ? (
        <ErrorState
          title="CRM overview unavailable"
          description={(overviewQuery.error as Error).message}
          onRetry={() => void overviewQuery.refetch()}
        />
      ) : overviewQuery.data ? (
        <CrmOverviewGrid
          overview={overviewQuery.data}
          onCreate={() => setCreateOpen(true)}
          onCompleteFollowUp={(row) => completeFollowUp.mutate({ followUpId: row.id })}
          onRescheduleFollowUp={(row) =>
            rescheduleFollowUp.mutate({
              followUpId: row.id,
              dueAt: new Date(Date.parse(row.dueAt) + 2 * 24 * 3600_000).toISOString(),
            })
          }
          onOpenFollowUp={openOpportunity}
        />
      ) : (
        <CardGridSkeleton count={6} />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New opportunity</DialogTitle>
          </DialogHeader>
          <CrmOpportunityForm
            owners={ownersQuery.data ?? []}
            submitting={createOpportunity.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(payload) => {
              createOpportunity.mutate(payload, { onSuccess: () => setCreateOpen(false) });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
