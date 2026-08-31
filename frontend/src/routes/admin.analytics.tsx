import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AnalyticsQuery } from "@/lib/contracts/analytics";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PortfolioTrendChart,
  RiskDistributionChart,
  SlaTrendChart,
  TurnaroundChart,
} from "@/features/analytics/components/analytics-charts";
import {
  CapacityPanel,
  ForecastPanel,
  PerformanceTable,
} from "@/features/analytics/components/analytics-tables";
import { useCaseFacets } from "@/features/cases/hooks/use-cases";

const WINDOWS: { value: NonNullable<AnalyticsQuery["window"]>; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Executive Analytics — Sapling Global" },
      {
        name: "description",
        content:
          "Portfolio throughput, SLA attainment, turnaround, outcome mix, owner workload and seven-day outlook.",
      },
      { property: "og:title", content: "Executive Analytics — Sapling Global" },
      {
        property: "og:description",
        content: "Throughput, SLA attainment, turnaround, workload and delivery outlook analytics.",
      },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [query, setQuery] = useState<AnalyticsQuery>({ clientId: "all", window: "30d" });
  const facets = useCaseFacets();
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: queryKeys.analytics(query),
    queryFn: () => api.analytics.getExecutive(query),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive analytics"
        description="Delivery performance across clients, branches and check types, with workload and seven-day outlook signals."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={query.clientId ?? "all"}
              onValueChange={(value) => setQuery((c) => ({ ...c, clientId: value }))}
            >
              <SelectTrigger className="w-[200px]" aria-label="Filter by client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {(facets.data?.clients ?? []).map((client) => (
                  <SelectItem key={client.value} value={client.value}>
                    {client.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={query.window ?? "30d"}
              onValueChange={(value) =>
                setQuery((c) => ({ ...c, window: value as AnalyticsQuery["window"] }))
              }
            >
              <SelectTrigger className="w-[160px]" aria-label="Select time window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}
      {isPending ? <CardGridSkeleton count={4} /> : null}

      {data ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <PortfolioTrendChart data={data.portfolioTrend} />
            <SlaTrendChart data={data.slaTrend} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <TurnaroundChart data={data.turnaroundTrend} />
            <RiskDistributionChart data={data.riskDistribution} />
          </div>
          <PerformanceTable
            title="Client performance"
            description="Volume and delivery quality by client account."
            rows={data.clientPerformance}
            entityLabel="Client"
            exceptionLabel="Overdue"
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PerformanceTable
              title="Branch performance"
              description="Delivery performance by operating location."
              rows={data.branchPerformance}
              entityLabel="Branch"
              exceptionLabel="Overdue"
            />
            <PerformanceTable
              title="Check performance"
              description="Turnaround and discrepancy rate by check type."
              rows={data.checkPerformance}
              entityLabel="Check"
              performanceLabel="Completion"
              exceptionLabel="Discrepancy"
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <CapacityPanel rows={data.capacity} />
            <ForecastPanel summary={data.forecast} />
          </div>
        </>
      ) : null}
    </div>
  );
}
