import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { ExecutiveCaseMovement } from "@/components/executive/ExecutiveCases";
import { ExecutiveAttention } from "@/components/executive/ExecutiveAttention";
import { ExecutiveBusinessHealth } from "@/components/executive/ExecutiveBusinessHealth";
import {
  ExecutiveDrilldown,
  type ExecutiveDrilldownSelection,
} from "@/components/executive/ExecutiveDrilldown";
import { ExecutiveFilters } from "@/components/executive/ExecutiveFilters";
import { ExecutiveScheduleDialog } from "@/components/executive/ExecutiveScheduleDialog";
import {
  OutcomeAndChecks,
  StageAgeing,
  TeamCapacity,
} from "@/components/executive/ExecutiveOperations";
import { ExecutivePerformanceTables } from "@/components/executive/ExecutivePerformanceTables";
import {
  ExecutivePerformance,
  PortfolioComposition,
} from "@/components/executive/ExecutivePerformance";
import { ExecutiveHeader, ExecutiveKpis } from "@/components/executive/ExecutiveSummary";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getExecutiveDashboard, type ExecutiveDashboardFilters } from "@/lib/api/dashboards";

export const Route = createFileRoute("/executive")({
  head: () => ({ meta: [{ title: "Executive pulse — Sapling Global" }] }),
  component: ExecutivePage,
});

function ExecutivePage() {
  const [filters, setFilters] = useState<ExecutiveDashboardFilters>({ months: 6 });
  const [drilldown, setDrilldown] = useState<ExecutiveDrilldownSelection | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const query = useQuery({
    queryKey: ["dashboard", "executive", filters],
    queryFn: () => getExecutiveDashboard(filters),
    refetchInterval: 60_000,
  });
  return (
    <div className="min-h-screen bg-white text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={() => void query.refetch()} isRefreshing={query.isFetching} />
        <main className="flex-1 space-y-4 px-4 pb-10 pt-4 sm:px-5">
          <ExecutiveHeader />
          <ExecutiveFilters
            data={query.data}
            value={filters}
            onChange={setFilters}
            onSchedule={() => setScheduleOpen(true)}
          />
          <ExecutiveScheduleDialog
            open={scheduleOpen}
            filters={filters}
            onClose={() => setScheduleOpen(false)}
          />
          {query.isError ? (
            <ErrorState message={query.error.message} retry={() => void query.refetch()} />
          ) : null}
          {query.isLoading ? <ExecutiveSkeleton /> : null}
          {query.data ? (
            <>
              <ExecutiveKpis data={query.data} onDrilldown={setDrilldown} />
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.72fr)]">
                <ExecutivePerformance data={query.data} />
                <ExecutiveAttention data={query.data} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[minmax(19rem,.72fr)_minmax(0,1.55fr)]">
                <PortfolioComposition data={query.data} onDrilldown={setDrilldown} />
                <ExecutivePerformanceTables
                  data={query.data}
                  onSelect={(kind, id, name) =>
                    setDrilldown({ kind, value: id, label: `${name} portfolio` })
                  }
                />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <StageAgeing
                  data={query.data}
                  onSelect={(status) =>
                    setDrilldown({
                      kind: "status",
                      value: status,
                      label: `${status.replaceAll("_", " ")} cases`,
                    })
                  }
                />
                <TeamCapacity
                  data={query.data}
                  onSelect={(id, name) =>
                    setDrilldown({ kind: "owner", value: id, label: `${name} workload` })
                  }
                />
              </div>
              <OutcomeAndChecks data={query.data} />
              <ExecutiveBusinessHealth data={query.data} />
              <ExecutiveCaseMovement items={query.data.recentCases} />
              <ExecutiveDrilldown
                selection={drilldown}
                rows={query.data.caseRegister}
                onClose={() => setDrilldown(null)}
              />
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ExecutiveSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-32 rounded-2xl bg-secondary/60" />
      ))}
    </div>
  );
}

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
      <span>{message}</span>
      <button
        type="button"
        onClick={retry}
        className="inline-flex items-center gap-1.5 font-semibold"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Retry
      </button>
    </div>
  );
}
