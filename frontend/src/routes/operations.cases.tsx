import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FolderSearch } from "lucide-react";
import type { OpsCaseQuery, OpsSlaState, OpsStage } from "@/features/operations/contracts/case";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { OpsCaseFilters } from "@/features/operations/components/ops-case-filters";
import { OpsCaseTable } from "@/features/operations/components/ops-case-table";
import { OpsCaseDrawer } from "@/features/operations/components/ops-case-drawer";
import { useOpsCase, useOpsCases, useOpsFacets } from "@/features/operations/hooks/use-operations";
import { Checkbox } from "@/components/ui/checkbox";
import { DispatchDialog } from "@/features/operations/dispatch/dispatch-dialog";
import { DispatchSelectionBar } from "@/features/operations/dispatch/dispatch-selection";
import {
  canSelectForDispatch,
  DISPATCH_LIMIT,
} from "@/features/operations/dispatch/dispatch-selection-model";

interface CasesSearch {
  caseId?: string;
  unassigned?: boolean;
  dueToday?: boolean;
  dueNext7Days?: boolean;
  sla?: OpsSlaState;
  stage?: OpsStage;
}

export const Route = createFileRoute("/operations/cases")({
  validateSearch: (search: Record<string, unknown>): CasesSearch => ({
    caseId: typeof search["caseId"] === "string" ? (search["caseId"] as string) : undefined,
    unassigned: search["unassigned"] === true || search["unassigned"] === "true" ? true : undefined,
    dueToday: search["dueToday"] === true || search["dueToday"] === "true" ? true : undefined,
    dueNext7Days:
      search["dueNext7Days"] === true || search["dueNext7Days"] === "true" ? true : undefined,
    sla: typeof search["sla"] === "string" ? (search["sla"] as OpsSlaState) : undefined,
    stage: typeof search["stage"] === "string" ? (search["stage"] as OpsStage) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Case 360 — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Every verification case with stage, checks, SLA, documents, clarifications and full audit timeline.",
      },
      { property: "og:title", content: "Case 360 — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Full delivery context for every verification case in one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OperationsCasesPage,
});

const PAGE_SIZE = 10;

function OperationsCasesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [query, setQuery] = useState<OpsCaseQuery>({
    page: 1,
    pageSize: PAGE_SIZE,
    sortBy: "sla",
    sortDir: "asc",
    unassigned: search.unassigned,
    dueToday: search.dueToday,
    dueNext7Days: search.dueNext7Days,
    sla: search.sla,
    stage: search.stage,
  });

  const { data, isPending, isError, isFetching, refetch } = useOpsCases(query);
  const facets = useOpsFacets();
  const detail = useOpsCase(search.caseId);
  const rows = data?.rows ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < DISPATCH_LIMIT
          ? [...current, id]
          : current,
    );
  const togglePage = () =>
    setSelected((current) => {
      const ids = rows.filter(canSelectForDispatch).map((row) => row.id);
      return ids.every((id) => current.includes(id))
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])].slice(0, DISPATCH_LIMIT);
    });

  const setCaseId = (caseId: string | undefined) => {
    void navigate({ to: ".", search: (prev) => ({ ...prev, caseId }) });
  };

  const patch = (next: Partial<OpsCaseQuery>) => setQuery((current) => ({ ...current, ...next }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Case 360"
        description="Complete delivery context for every case: checks, documents, clarifications, field visits and QA."
        meta={data ? `${data.total} cases match the current filters` : undefined}
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}
      <DispatchSelectionBar
        selected={selected}
        onClear={() => setSelected([])}
        onStart={() => setDispatchOpen(true)}
      />

      <div className="surface overflow-hidden">
        <OpsCaseFilters
          query={query}
          clients={facets.data?.clients ?? []}
          owners={facets.data?.owners ?? []}
          onChange={patch}
          onReset={() => setQuery({ page: 1, pageSize: PAGE_SIZE, sortBy: "sla", sortDir: "asc" })}
        />

        {isPending ? (
          <div className="p-5">
            <TableSkeleton rows={8} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FolderSearch}
              title="No cases match these filters"
              description="Widen the SLA state, clear the search term or switch off the quick filters."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuery({ page: 1, pageSize: PAGE_SIZE, sortBy: "sla", sortDir: "asc" })
                  }
                >
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <OpsCaseTable
              rows={rows}
              query={query}
              onSort={(key) =>
                patch({
                  sortBy: key,
                  sortDir: query.sortBy === key && query.sortDir === "asc" ? "desc" : "asc",
                })
              }
              onOpenCase={setCaseId}
              selection={{ selected, onToggle: toggle, onTogglePage: togglePage }}
            />
            <ul className="divide-y divide-border lg:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Checkbox
                    aria-label={`Select ${row.caseNumber}`}
                    checked={selected.includes(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                    disabled={
                      !canSelectForDispatch(row) ||
                      (!selected.includes(row.id) && selected.length >= DISPATCH_LIMIT)
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {row.candidateName}
                    </p>
                    <p className="num truncate text-[11px] text-muted-foreground">
                      {row.caseNumber} · {row.clientName}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCaseId(row.id)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
            <PaginationBar
              page={data?.page ?? 1}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onPageChange={(page) => patch({ page })}
              label="cases"
            />
          </>
        )}
      </div>

      <OpsCaseDrawer
        caseDetail={detail.data}
        loading={detail.isPending && Boolean(search.caseId)}
        open={Boolean(search.caseId)}
        onClose={() => setCaseId(undefined)}
      />
      {dispatchOpen ? (
        <DispatchDialog
          caseIds={selected}
          onClose={() => {
            setDispatchOpen(false);
            setSelected([]);
          }}
          onOpenCase={setCaseId}
        />
      ) : null}
    </div>
  );
}
