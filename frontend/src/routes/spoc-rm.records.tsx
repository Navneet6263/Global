import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import {
  SpocCaseDrawer,
  SpocFilterBar,
  SpocRecordsView,
  spocRecordsSearch,
  type SpocRecordsSearch,
} from "@/features/spoc-rm";

export const Route = createFileRoute("/spoc-rm/records")({
  validateSearch: spocRecordsSearch,
  head: () => ({ meta: [{ title: "SPOC-RM Records — Sapling Global" }] }),
  component: SpocRecordsPage,
});

function SpocRecordsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const update = useCallback(
    (patch: Partial<SpocRecordsSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), replace: true }),
    [navigate],
  );

  return (
    <>
      <PageHeader
        title="Records"
        description="View-only cases, verifier tasks, QA, field visits, opportunities and invoices within your monitoring scope."
      />
      <SpocFilterBar
        value={{
          clientId: search.clientId,
          branchId: search.branchId,
          priority: search.priority,
          from: search.from,
          to: search.to,
        }}
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
      <SpocRecordsView
        search={search}
        onChange={update}
        onOpenCase={(caseId) => update({ caseId })}
      />
      <SpocCaseDrawer caseId={search.caseId} onClose={() => update({ caseId: undefined })} />
    </>
  );
}
