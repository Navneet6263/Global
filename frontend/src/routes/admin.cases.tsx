import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CasePriority, CaseStage } from "@/lib/contracts/case";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { CaseFilterBar } from "@/features/cases/components/case-filter-bar";
import { CaseTable } from "@/features/cases/components/case-table";
import { CaseMobileList } from "@/features/cases/components/case-mobile-list";
import { CaseDetailDrawer } from "@/features/cases/components/case-detail-drawer";
import { CaseBulkBar } from "@/features/cases/components/case-bulk-bar";
import { useCaseFacets, useCases } from "@/features/cases/hooks/use-cases";
import { useCaseRegister } from "@/features/cases/hooks/use-case-register";
import { FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCases } from "@/lib/backend-api/cases";
import { downloadCsv } from "@/lib/csv";

interface CasesSearch {
  q?: string;
  stage?: CaseStage;
  caseId?: string;
}

export const Route = createFileRoute("/admin/cases")({
  validateSearch: (search: Record<string, unknown>): CasesSearch => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
    stage: typeof search["stage"] === "string" ? (search["stage"] as CaseStage) : undefined,
    caseId: typeof search["caseId"] === "string" ? (search["caseId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verification Register — Sapling Global" },
      {
        name: "description",
        content:
          "Filter, sort and action every background verification case with SLA, stage and ownership visibility.",
      },
      { property: "og:title", content: "Verification Register — Sapling Global" },
      {
        property: "og:description",
        content: "Every background verification case with SLA, stage and ownership visibility.",
      },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const register = useCaseRegister({ search: search.q, stage: search.stage });
  const { query, activeView, visibleColumns, selected, actions, pageSize } = register;

  const { data, isPending, isError, isFetching, refetch } = useCases(query);
  const facets = useCaseFacets();
  const rows = data?.rows ?? [];
  const exportMutation = useMutation({
    mutationFn: () =>
      exportCases({
        search: query.search,
        stage: query.stage === "all" ? undefined : query.stage,
        clientId: query.clientId === "all" ? undefined : query.clientId,
        priority: backendPriority(query.priority),
        sla: query.sla === "all" ? undefined : query.sla,
        from: query.from,
        to: query.to,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
      }),
    onSuccess: () => toast.success("Case register downloaded"),
    onError: (error: Error) => toast.error("Export failed", { description: error.message }),
  });

  const setCaseId = (caseId: string | undefined) => {
    void navigate({ search: (prev) => ({ ...prev, caseId }) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification register"
        description="Every case across clients with live stage, SLA and ownership. Saved views mirror how operations triage the day."
        meta={data ? `${data.total} cases match the current filters` : undefined}
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      <div className="surface overflow-hidden">
        <CaseFilterBar
          query={query}
          clients={facets.data?.clients ?? []}
          visibleColumns={visibleColumns}
          activeView={activeView}
          onQueryChange={actions.patchQuery}
          onViewChange={actions.applyView}
          onToggleColumn={actions.toggleColumn}
          onExport={() => exportMutation.mutate()}
          onReset={actions.reset}
        />

        {selected.length > 0 ? (
          <CaseBulkBar
            count={selected.length}
            onClear={actions.clearSelection}
            onExport={() => {
              const selectedRows = rows.filter((row) => selected.includes(row.id));
              if (selectedRows.length !== selected.length) {
                toast.error("Selection changed", {
                  description: "Select the cases again from the current page before exporting.",
                });
                actions.clearSelection();
                return;
              }
              downloadCsv(
                `sapling-global-selected-cases-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Case number", "Candidate", "Client", "Stage", "Priority", "Owner"],
                selectedRows.map((row) => [
                  row.caseNumber,
                  row.candidateName,
                  row.clientName,
                  row.stage,
                  row.priority,
                  row.owner ?? "",
                ]),
              );
              actions.clearSelection();
            }}
          />
        ) : null}

        {isPending ? (
          <div className="p-5">
            <TableSkeleton rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FolderSearch}
              title="No cases match these filters"
              description="Try a different saved view, widen the SLA state, or clear the search term."
              action={
                <Button variant="outline" size="sm" onClick={actions.reset}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <CaseTable
              rows={rows}
              query={query}
              visibleColumns={visibleColumns}
              selected={selected}
              onSort={actions.sortBy}
              onToggleRow={actions.toggleRow}
              onToggleAll={() =>
                actions.selectMany(
                  rows.map((row) => row.id),
                  rows.every((row) => selected.includes(row.id)),
                )
              }
              onOpenCase={setCaseId}
            />
            <CaseMobileList rows={rows} onOpenCase={setCaseId} />
            <PaginationBar
              page={query.page ?? 1}
              pageSize={pageSize}
              total={data?.total ?? 0}
              onPageChange={actions.setPage}
              label="cases"
            />
          </>
        )}
      </div>

      <CaseDetailDrawer caseId={search.caseId} onClose={() => setCaseId(undefined)} />
    </div>
  );
}

function backendPriority(priority: CasePriority | "all" | undefined) {
  if (!priority || priority === "all") return undefined;
  return { standard: "NORMAL", high: "HIGH", critical: "URGENT" }[priority];
}
