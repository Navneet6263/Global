"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { z } from "zod";
import type { FollowUpQuery, FollowUpView } from "@/features/crm/contracts/crm";
import {
  useCompleteFollowUp,
  useFollowUps,
  useRescheduleFollowUp,
  useSalesOwners,
} from "@/features/crm/hooks/use-crm";
import { CrmFollowUpPanel } from "@/features/crm/components/crm-followup-panel";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { EmptyState } from "@/components/feedback/empty-state";
import { cn } from "@/lib/utils";

const VIEWS: readonly { id: FollowUpView; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "week", label: "This week" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

const searchSchema = z.object({
  view: z.string().optional(),
  owner: z.string().optional(),
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/sales-crm/follow-ups")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Follow-up Workbench — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Overdue, due-today and upcoming sales follow-ups with one-click complete and reschedule.",
      },
      { property: "og:title", content: "Follow-up Workbench — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Never drop a commitment: prioritised follow-up queue for the sales desk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ownersQuery = useSalesOwners();
  const complete = useCompleteFollowUp();
  const reschedule = useRescheduleFollowUp();

  const view = (search.view as FollowUpView | undefined) ?? "overdue";
  const query: FollowUpQuery = {
    view,
    owner: search.owner ?? "all",
    search: search.search,
    page: search.page ?? 1,
    pageSize: 10,
  };
  const listQuery = useFollowUps(query);

  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });

  return (
    <>
      <PageHeader
        title="Follow-up workbench"
        description="Work the commitment queue: overdue first, then today, then what's coming next."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-white/80 bg-card/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-mint-soft/70 p-1">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "completed") {
                  void navigate({ to: "/sales-crm/activities", search: { type: "FOLLOW_UP" } });
                  return;
                }
                setSearch({ view: item.id, page: 1 });
              }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors",
                view === item.id
                  ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search company or contact"
          className="max-w-xs"
          value={search.search ?? ""}
          onChange={(event) => setSearch({ search: event.target.value || undefined, page: 1 })}
        />
        <Select
          value={search.owner ?? "all"}
          onValueChange={(value) => setSearch({ owner: value, page: 1 })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {(ownersQuery.data ?? []).map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {listQuery.isPending ? (
        <ListSkeleton rows={6} />
      ) : !listQuery.data || listQuery.data.rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="Nothing pending in this view"
          description="This queue is clear. Switch views to check another scheduled period."
        />
      ) : (
        <div className="space-y-3">
          <CrmFollowUpPanel
            followUps={listQuery.data.rows}
            limit={10}
            onComplete={(row) => complete.mutate({ followUpId: row.id })}
            onReschedule={(row) =>
              reschedule.mutate({
                followUpId: row.id,
                dueAt: new Date(Date.parse(row.dueAt) + 2 * 24 * 3600_000).toISOString(),
              })
            }
            onOpen={(row) =>
              void navigate({
                to: "/sales-crm/opportunities",
                search: { opportunityId: row.opportunityId, view: "table" },
              })
            }
          />
          <div className="rounded-[1.4rem] border border-white/80 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <PaginationBar
              page={listQuery.data.page}
              pageSize={listQuery.data.pageSize}
              total={listQuery.data.total}
              label="follow-ups"
              onPageChange={(page) => setSearch({ page })}
            />
          </div>
        </div>
      )}
    </>
  );
}
