"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { z } from "zod";
import type { ActivityQuery, SalesActivityType } from "@/features/crm/contracts/crm";
import { ACTIVITY_LABEL } from "@/features/crm/config/crm";
import { useSalesActivities, useSalesOwners } from "@/features/crm/hooks/use-crm";
import { CrmActivityFeed } from "@/features/crm/components/crm-activity-feed";
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

const searchSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  owner: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/sales-crm/activities")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Activity Timeline — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Chronological log of calls, emails, meetings and stage changes across the sales pipeline.",
      },
      { property: "og:title", content: "Activity Timeline — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Every logged sales touchpoint with actor, account and timestamp in IST.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActivitiesPage,
});

function ActivitiesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ownersQuery = useSalesOwners();

  const query: ActivityQuery = {
    search: search.search,
    type: (search.type as SalesActivityType | undefined) ?? "all",
    owner: search.owner ?? "all",
    page: search.page ?? 1,
    pageSize: 12,
  };
  const listQuery = useSalesActivities(query);

  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });

  return (
    <>
      <PageHeader
        title="Activity timeline"
        description="Every call, email, meeting and stage movement logged by the sales desk."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-white/80 bg-card/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <Input
          placeholder="Search company, contact or summary"
          className="max-w-xs"
          value={search.search ?? ""}
          onChange={(event) => setSearch({ search: event.target.value || undefined, page: 1 })}
        />
        <Select
          value={search.type ?? "all"}
          onValueChange={(value) => setSearch({ type: value, page: 1 })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Activity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity types</SelectItem>
            {Object.keys(ACTIVITY_LABEL).map((value) => (
              <SelectItem key={value} value={value}>
                {ACTIVITY_LABEL[value as SalesActivityType]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          icon={Inbox}
          title="No activities logged for this filter"
          description="Log a call, email or meeting from an opportunity to see it appear here."
        />
      ) : (
        <div className="space-y-3">
          <CrmActivityFeed activities={listQuery.data.rows} limit={12} showLink={false} />
          <div className="rounded-[1.4rem] border border-white/80 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <PaginationBar
              page={listQuery.data.page}
              pageSize={listQuery.data.pageSize}
              total={listQuery.data.total}
              label="activities"
              onPageChange={(page) => setSearch({ page })}
            />
          </div>
        </div>
      )}
    </>
  );
}
