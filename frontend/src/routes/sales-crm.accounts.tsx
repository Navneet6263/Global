"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { z } from "zod";
import type { AccountQuery, SalesAccount } from "@/features/crm/contracts/crm";
import { useSalesAccounts, useSalesOwners } from "@/features/crm/hooks/use-crm";
import { CrmAccountsTable } from "@/features/crm/components/crm-accounts-table";
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
import { TableSkeleton } from "@/components/feedback/skeletons";
import { EmptyState } from "@/components/feedback/empty-state";

const STATUSES: readonly { value: SalesAccount["status"]; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "churn-risk", label: "Churn risk" },
];

const searchSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  owner: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/sales-crm/accounts")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Accounts — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Commercial account book with pipeline value, won revenue, owner and engagement recency.",
      },
      { property: "og:title", content: "Accounts — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Track prospects, active clients, dormant logos and churn-risk accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ownersQuery = useSalesOwners();

  const query: AccountQuery = {
    search: search.search,
    status: (search.status as SalesAccount["status"] | undefined) ?? "all",
    owner: search.owner ?? "all",
    page: search.page ?? 1,
    pageSize: 10,
  };
  const listQuery = useSalesAccounts(query);

  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });

  return (
    <>
      <PageHeader
        title="Accounts"
        description="The commercial account book behind the pipeline — who buys, who's cooling off, who's at risk."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[1.4rem] border border-white/80 bg-card/80 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm">
        <Input
          placeholder="Search company, contact or city"
          className="max-w-xs"
          value={search.search ?? ""}
          onChange={(event) => setSearch({ search: event.target.value || undefined, page: 1 })}
        />
        <Select
          value={search.status ?? "all"}
          onValueChange={(value) => setSearch({ status: value, page: 1 })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
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
        <TableSkeleton rows={8} />
      ) : !listQuery.data || listQuery.data.rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No accounts match these filters"
          description="Adjust the status or owner filter to widen the account book."
        />
      ) : (
        <div className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
          <CrmAccountsTable
            rows={listQuery.data.rows}
            onOpen={(account) =>
              void navigate({
                to: "/sales-crm/opportunities",
                search: { search: account.company, view: "table" },
              })
            }
          />
          <PaginationBar
            page={listQuery.data.page}
            pageSize={listQuery.data.pageSize}
            total={listQuery.data.total}
            label="accounts"
            onPageChange={(page) => setSearch({ page })}
          />
        </div>
      )}
    </>
  );
}
