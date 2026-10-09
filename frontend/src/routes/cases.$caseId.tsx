import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { OperationsShell } from "@/features/operations/workspace/OperationsShell";
import { CaseError, CaseSkeleton } from "@/features/cases/case-detail-ui";
import { OpsCaseHeader, OpsCaseRail } from "@/features/operations/workspace/OpsCaseWorkspace";
import { CaseWorkspaceTabs } from "@/features/cases/case-workspace-tabs";
import { CaseActions } from "@/features/cases/case-workflow-panels";
import { getCase, type CaseDetail } from "@/lib/api/cases";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { caseWorkspaceSearch } from "@/features/cases/case-workspace-search";

export const Route = createFileRoute("/cases/$caseId")({
  validateSearch: caseWorkspaceSearch,
  ssr: false,
  beforeLoad: () => requireRoleWorkspace(["OPS_MANAGER", "PLATFORM_ADMIN"]),
  component: CaseWorkspace,
  head: () => ({ meta: [{ title: "Case 360 — Sapling Global" }] }),
});

function CaseWorkspace() {
  const { caseId } = Route.useParams();
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
  });

  return (
    <OperationsShell>
      {query.isLoading ? <CaseSkeleton /> : null}
      {query.isError ? <CaseError message={query.error.message} /> : null}
      {query.data ? <CaseDetailView item={query.data} /> : null}
    </OperationsShell>
  );
}

function CaseDetailView({ item }: { item: CaseDetail }) {
  const { tab, inbox } = Route.useSearch();
  return (
    <div className="ops-case-page">
      <nav className="ops-back" aria-label="Back">
        {inbox ? (
          <Link to="/operations/attention" search={{ action: inbox }}>
            <ArrowLeft aria-hidden /> Back to action inbox
          </Link>
        ) : (
          <Link to="/operations">
            <ArrowLeft aria-hidden /> Back to work queue
          </Link>
        )}
        <Link to="/operations/cases">All cases</Link>
      </nav>
      <OpsCaseHeader item={item} />
      <CaseActions item={item} />
      <div className="ops-case-layout">
        <div className="ops-case-main">
          <CaseWorkspaceTabs key={`${item.id}:${tab ?? "overview"}`} item={item} initialTab={tab} />
        </div>
        <OpsCaseRail item={item} />
      </div>
    </div>
  );
}
