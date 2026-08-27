"use client";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import type { ForecastQuery } from "@/features/crm/contracts/crm";
import { useRevenueForecast, useSalesOwners } from "@/features/crm/hooks/use-crm";
import {
  CrmForecastBuckets,
  CrmForecastSummary,
} from "@/features/crm/components/crm-forecast-panels";
import { CrmTrendCard } from "@/features/crm/components/crm-trend-card";
import { CrmOpportunityTable } from "@/features/crm/components/crm-opportunity-table";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardGridSkeleton } from "@/components/feedback/skeletons";

const PERIODS = [
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
] as const;

const searchSchema = z.object({
  period: z.enum(["month", "quarter", "year"]).optional(),
  owner: z.string().optional(),
});

export const Route = createFileRoute("/sales-crm/forecast")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Revenue Forecast — Sapling Global Sales & CRM" },
      {
        name: "description",
        content:
          "Weighted, commit and best-case revenue forecast by owner and stage with gap-to-target tracking.",
      },
      { property: "og:title", content: "Revenue Forecast — Sapling Global Sales & CRM" },
      {
        property: "og:description",
        content: "Forecast confidence across owners and stages, plus deals at risk of slipping.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForecastPage,
});

function ForecastPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const ownersQuery = useSalesOwners();

  const query: ForecastQuery = {
    period: search.period ?? "quarter",
    owner: search.owner ?? "all",
  };
  const forecastQuery = useRevenueForecast(query);

  const setSearch = (patch: Record<string, unknown>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }) });

  return (
    <>
      <PageHeader
        title="Revenue forecast"
        description="How much revenue actually lands this period — weighted, commit and best case against target."
        actions={
          <div className="flex items-center gap-2">
            <Select value={query.period} onValueChange={(value) => setSearch({ period: value })}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={query.owner} onValueChange={(value) => setSearch({ owner: value })}>
              <SelectTrigger className="w-[190px]">
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
        }
      />

      {forecastQuery.data ? (
        <div className="space-y-5">
          <CrmForecastSummary forecast={forecastQuery.data} />
          <CrmTrendCard trend={forecastQuery.data.monthly} />
          <div className="grid gap-5 xl:grid-cols-2">
            <CrmForecastBuckets
              title="Weighted forecast by owner"
              buckets={forecastQuery.data.byOwner}
              accentId="weightedForecast"
            />
            <CrmForecastBuckets
              title="Weighted forecast by stage"
              buckets={forecastQuery.data.byStage}
              accentId="openPipeline"
            />
          </div>
          <section className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-card/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
            <header className="px-5 pt-5 pb-3">
              <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                Deals at risk of slipping
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                High-value deals with a close date near or past due and no recent movement.
              </p>
            </header>
            <CrmOpportunityTable
              rows={forecastQuery.data.atRisk}
              onOpen={(row) =>
                void navigate({
                  to: "/sales-crm/opportunities",
                  search: { opportunityId: row.id, view: "table" },
                })
              }
            />
          </section>
        </div>
      ) : (
        <CardGridSkeleton count={6} />
      )}
    </>
  );
}
