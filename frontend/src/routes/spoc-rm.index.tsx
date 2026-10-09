import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import {
  SpocAttentionQueue,
  SpocCaseDrawer,
  SpocClientTable,
  SpocExceptionsPanel,
  SpocFilterBar,
  SpocKpiStrip,
  SpocRoleMatrix,
  SpocWorkflowStrip,
  spocOverviewSearch,
  useSpocOverview,
  type SpocOverviewSearch,
  type SpocScopeFilters,
} from "@/features/spoc-rm";
import { relative } from "@/features/spoc-rm/utils/spoc-format";

export const Route = createFileRoute("/spoc-rm/")({
  validateSearch: spocOverviewSearch,
  head: () => ({ meta: [{ title: "SPOC-RM Monitoring — Sapling Global" }] }),
  component: SpocOverviewPage,
});

function SpocOverviewPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const scope: SpocScopeFilters = {
    clientId: search.clientId,
    branchId: search.branchId,
    priority: search.priority,
    from: search.from,
    to: search.to,
  };
  const overview = useSpocOverview(scope);
  const update = (patch: Partial<SpocOverviewSearch>) =>
    void navigate({ search: (current) => ({ ...current, ...patch }), replace: true });
  const openCase = (caseId: string) => update({ caseId });

  return (
    <>
      <PageHeader
        title="Monitoring overview"
        description="View-only picture of work across operations, verification, QA, clients, field, sales and finance."
        meta={
          overview.data ? (
            <span className="text-[11px] text-muted-foreground">
              Updated {relative(overview.data.generatedAt)}
            </span>
          ) : null
        }
      />
      <SpocFilterBar
        value={scope}
        onChange={(next) =>
          update({
            clientId: next.clientId,
            branchId: next.branchId,
            priority: next.priority,
            from: next.from,
            to: next.to,
            page: undefined,
          })
        }
      />
      {overview.isError ? (
        <ErrorState
          description={overview.error.message}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      ) : !overview.data ? (
        <div className="space-y-5" aria-label="Loading monitoring overview">
          <CardGridSkeleton count={8} />
          <ListSkeleton rows={6} />
        </div>
      ) : (
        <div className="space-y-5" aria-busy={overview.isFetching}>
          <SpocKpiStrip data={overview.data} scope={scope} />
          <SpocRoleMatrix rows={overview.data.roles} scope={scope} />
          <SpocWorkflowStrip stages={overview.data.workflow} scope={scope} />
          <div className="grid gap-5 2xl:grid-cols-2">
            <SpocExceptionsPanel
              scope={scope}
              category={search.category ?? "overdue"}
              page={search.page ?? 1}
              onCategory={(category) => update({ category, page: undefined })}
              onPage={(page) => update({ page })}
              onOpenCase={openCase}
            />
            <SpocAttentionQueue items={overview.data.attention} onOpenCase={openCase} />
          </div>
          <SpocClientTable
            title="Client overview"
            description="First clients alphabetically; the Clients page has the full roll-up with search."
            query={{ page: 1, pageSize: 8, clientId: scope.clientId }}
          />
        </div>
      )}
      <SpocCaseDrawer caseId={search.caseId} onClose={() => update({ caseId: undefined })} />
    </>
  );
}
