import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

import { CrmHeader, CrmKpis } from "@/components/crm/CrmHeader";
import { CrmActivity } from "@/components/crm/CrmInsights";
import { CrmPipeline } from "@/components/crm/CrmPipeline";
import { OpportunityDrawer } from "@/components/crm/OpportunityDrawer";
import { OpportunityDetailDrawer } from "@/components/crm/OpportunityDetailDrawer";
import { OpportunityRegisterV2 } from "@/components/crm/OpportunityRegisterV2";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { getCrmOverview, listOpportunities, type OpportunityStage } from "@/lib/api/crm";

export const Route = createFileRoute("/sales-crm")({
  head: () => ({ meta: [{ title: "Revenue workspace — Sapling Global" }] }),
  component: SalesCrm,
});

function SalesCrm() {
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [stage, setStage] = useState<OpportunityStage | "ALL">("ALL");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const deferredSearch = useDeferredValue(search.trim());
  useEffect(() => {
    setCursor(undefined);
    setCursorHistory([]);
  }, [deferredSearch]);
  const overview = useQuery({
    queryKey: ["crm", "overview"],
    queryFn: getCrmOverview,
    refetchInterval: 60_000,
  });
  const opportunities = useQuery({
    queryKey: ["crm", "opportunities", deferredSearch, stage, cursor],
    queryFn: () =>
      listOpportunities({
        limit: 25,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(stage !== "ALL" ? { stage } : {}),
        ...(cursor ? { cursor } : {}),
      }),
  });
  const rows = opportunities.data?.items ?? [];
  const refresh = () => {
    void overview.refetch();
    void opportunities.refetch();
  };
  return (
    <div className="min-h-screen bg-white text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          search={search}
          searchPlaceholder="Search company, contact or owner…"
          onSearchChange={setSearch}
          onRefresh={refresh}
          isRefreshing={overview.isFetching || opportunities.isFetching}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 pt-4 sm:px-5">
          <CrmHeader onNew={() => setDrawerOpen(true)} />
          {overview.isError || opportunities.isError ? (
            <ErrorState
              message={
                overview.error?.message ??
                opportunities.error?.message ??
                "CRM data could not be loaded"
              }
              retry={refresh}
            />
          ) : null}
          {overview.isLoading ? <CrmSkeleton /> : null}
          {overview.data ? (
            <>
              <CrmKpis data={overview.data} />
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,.55fr)]">
                <CrmPipeline items={rows} onOpen={setSelectedId} />
                <CrmActivity activities={overview.data.activities} />
              </div>
              <OpportunityRegisterV2
                items={rows}
                stage={stage}
                page={cursorHistory.length + 1}
                hasPrevious={cursorHistory.length > 0}
                hasNext={Boolean(opportunities.data?.nextCursor)}
                onStage={(value) => {
                  setStage(value);
                  setCursor(undefined);
                  setCursorHistory([]);
                }}
                onPrevious={() => {
                  const history = [...cursorHistory];
                  setCursor(history.pop());
                  setCursorHistory(history);
                }}
                onNext={() => {
                  const next = opportunities.data?.nextCursor;
                  if (!next) return;
                  setCursorHistory((current) => [...current, cursor]);
                  setCursor(next);
                }}
                onOpen={setSelectedId}
              />
            </>
          ) : null}
        </main>
      </div>
      <OpportunityDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      {selectedId ? (
        <OpportunityDetailDrawer id={selectedId} onClose={() => setSelectedId(undefined)} />
      ) : null}
    </div>
  );
}

function CrmSkeleton() {
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
