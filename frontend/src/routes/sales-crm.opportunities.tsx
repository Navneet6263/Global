"use client";

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Plus, Rows3, SearchX } from "lucide-react";
import { z } from "zod";
import type { CrmStage, Opportunity, OpportunityQuery } from "@/features/crm/contracts/crm";
import {
  useAddActivity,
  useAssignOwner,
  useChangeStage,
  useCreateOpportunity,
  useOpportunities,
  useOpportunity,
  usePrepareOnboarding,
  useSalesOwners,
  useUpdateOpportunity,
} from "@/features/crm/hooks/use-crm";
import { CrmOpportunityFilters } from "@/features/crm/components/crm-opportunity-filters";
import { CrmOpportunityTable } from "@/features/crm/components/crm-opportunity-table";
import { CrmOpportunityBoard } from "@/features/crm/components/crm-opportunity-board";
import { CrmOpportunityDrawer } from "@/features/crm/components/crm-opportunity-drawer";
import { CrmOpportunityForm } from "@/features/crm/components/crm-opportunity-form";
import { CrmActivityDialog } from "@/features/crm/components/crm-activity-dialog";
import { CrmMarkLostDialog, CrmMarkWonDialog } from "@/features/crm/components/crm-stage-dialogs";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { EmptyState } from "@/components/feedback/empty-state";
import { sessionForNav } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  view: z.enum(["board", "table"]).optional(),
  stage: z.string().optional(),
  owner: z.string().optional(),
  source: z.string().optional(),
  followUp: z.string().optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
  savedView: z.string().optional(),
  opportunityId: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/sales-crm/opportunities")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Opportunities — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Stage-wise opportunity board and pipeline table with owner, value and probability controls.",
      },
      { property: "og:title", content: "Opportunities — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Work the verification sales pipeline from New to Won with full stage control.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const session = sessionForNav("sales-crm");
  const canWrite = can(session, "crm:write");
  const canAssign = can(session, "crm:write");

  const view = search.view ?? "board";
  const query: OpportunityQuery = {
    search: search.search,
    stage: (search.stage as CrmStage | undefined) ?? "all",
    owner: search.owner ?? "all",
    source: search.source as OpportunityQuery["source"],
    followUp: search.followUp as OpportunityQuery["followUp"],
    sort: search.sort as OpportunityQuery["sort"],
    savedView: search.savedView ?? "all",
    page: search.page ?? 1,
    pageSize: view === "board" ? 60 : 10,
  };

  const listQuery = useOpportunities(query);
  const ownersQuery = useSalesOwners();
  const detailQuery = useOpportunity(search.opportunityId);
  const changeStage = useChangeStage();
  const assignOwner = useAssignOwner();
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();
  const addActivity = useAddActivity();
  const prepareOnboarding = usePrepareOnboarding();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });

  const open = (opportunity: Opportunity) => setSearch({ opportunityId: opportunity.id });
  const detail = detailQuery.data;

  return (
    <>
      <PageHeader
        title="Opportunities"
        description="Every open and closed deal with stage, owner, value and next action in one place."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex gap-1 rounded-full bg-mint-soft/70 p-1">
              {(["board", "table"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSearch({ view: mode, page: 1 })}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium capitalize transition-colors",
                    view === mode
                      ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "board" ? (
                    <LayoutGrid className="size-3.5" aria-hidden />
                  ) : (
                    <Rows3 className="size-3.5" aria-hidden />
                  )}
                  {mode}
                </button>
              ))}
            </div>
            {canWrite ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                New opportunity
              </Button>
            ) : null}
          </div>
        }
      />

      <CrmOpportunityFilters
        query={query}
        owners={ownersQuery.data ?? []}
        onChange={(patch) => setSearch(patch as Record<string, unknown>)}
        onReset={() => void navigate({ search: { view } as never })}
      />

      {listQuery.isPending ? (
        <TableSkeleton rows={8} />
      ) : !listQuery.data || listQuery.data.rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No opportunities match these filters"
          description="Clear the filters or create a new opportunity to start a pipeline."
        />
      ) : view === "board" ? (
        <div className="space-y-3">
          <CrmOpportunityBoard
            rows={listQuery.data.rows}
            canWrite={canWrite}
            changingId={changeStage.isPending ? changeStage.variables?.opportunityId : undefined}
            onOpen={open}
            onAdvance={(row, stage) => changeStage.mutate({ opportunityId: row.id, stage })}
          />
          <PaginationBar
            page={listQuery.data.page}
            pageSize={listQuery.data.pageSize}
            total={listQuery.data.total}
            label="opportunities"
            onPageChange={(page) => setSearch({ page })}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <CrmOpportunityTable rows={listQuery.data.rows} onOpen={open} />
          <PaginationBar
            page={listQuery.data.page}
            pageSize={listQuery.data.pageSize}
            total={listQuery.data.total}
            label="opportunities"
            onPageChange={(page) => setSearch({ page })}
          />
        </div>
      )}

      <CrmOpportunityDrawer
        detail={detail}
        owners={ownersQuery.data ?? []}
        open={Boolean(search.opportunityId)}
        loading={detailQuery.isPending}
        canWrite={canWrite}
        canAssign={canAssign}
        assigning={assignOwner.isPending}
        changingStage={changeStage.isPending}
        preparingOnboarding={prepareOnboarding.isPending}
        onOpenChange={(next) => (next ? undefined : setSearch({ opportunityId: undefined }))}
        onStageChange={(stage) => {
          if (!detail) return;
          if (stage === "WON") return setWonOpen(true);
          if (stage === "LOST") return setLostOpen(true);
          changeStage.mutate({ opportunityId: detail.id, stage });
        }}
        onAssign={(ownerId) =>
          detail ? assignOwner.mutate({ opportunityId: detail.id, ownerId }) : undefined
        }
        onEdit={() => setEditOpen(true)}
        onLogActivity={() => setActivityOpen(true)}
        onMarkWon={() => setWonOpen(true)}
        onMarkLost={() => setLostOpen(true)}
        onHandoff={() => (detail ? prepareOnboarding.mutate(detail.id) : undefined)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New opportunity</DialogTitle>
          </DialogHeader>
          <CrmOpportunityForm
            owners={ownersQuery.data ?? []}
            submitting={createOpportunity.isPending}
            onCancel={() => setCreateOpen(false)}
            onSubmit={(payload) =>
              createOpportunity.mutate(payload, { onSuccess: () => setCreateOpen(false) })
            }
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit opportunity</DialogTitle>
          </DialogHeader>
          {detail ? (
            <CrmOpportunityForm
              owners={ownersQuery.data ?? []}
              opportunity={detail}
              submitting={updateOpportunity.isPending}
              onCancel={() => setEditOpen(false)}
              onSubmit={(payload) =>
                updateOpportunity.mutate(
                  { id: detail.id, input: payload },
                  { onSuccess: () => setEditOpen(false) },
                )
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <CrmActivityDialog
        company={detail?.company}
        open={activityOpen}
        submitting={addActivity.isPending}
        onOpenChange={setActivityOpen}
        onSubmit={(payload) => {
          if (!detail) return;
          addActivity.mutate(
            { opportunityId: detail.id, ...payload },
            { onSuccess: () => setActivityOpen(false) },
          );
        }}
      />

      <CrmMarkWonDialog
        submitting={changeStage.isPending}
        opportunity={detail}
        open={wonOpen}
        onOpenChange={setWonOpen}
        onConfirm={({ finalValue, notes }) => {
          if (!detail) return;
          changeStage.mutate(
            { opportunityId: detail.id, stage: "WON", finalValue, notes },
            { onSuccess: () => setWonOpen(false) },
          );
        }}
      />

      <CrmMarkLostDialog
        submitting={changeStage.isPending}
        opportunity={detail}
        open={lostOpen}
        onOpenChange={setLostOpen}
        onConfirm={({ lostReason, competitor, notes }) => {
          if (!detail) return;
          changeStage.mutate(
            { opportunityId: detail.id, stage: "LOST", lostReason, competitor, notes },
            { onSuccess: () => setLostOpen(false) },
          );
        }}
      />
    </>
  );
}
