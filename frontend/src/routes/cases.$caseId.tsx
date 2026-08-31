import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, ClipboardCheck, Clock3 } from "lucide-react";

import { AdminShell } from "@/components/shell/admin-shell";
import { CaseActions, CandidatePanel, CheckCard } from "@/features/cases/case-workflow-panels";
import { FieldVisitPanel } from "@/features/cases/case-field-visit-panel";
import { ConsentPanel, DocumentPanel, ReportsPanel } from "@/features/cases/case-evidence-panels";
import { ClarificationPanel } from "@/features/cases/case-clarification-panel";
import {
  CaseError,
  CaseSkeleton,
  Metric,
  Panel,
  WorkflowStrip,
} from "@/features/cases/case-detail-ui";
import { formatDate, formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { getCase, type CaseDetail } from "@/lib/api/cases";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/cases/$caseId")({
  beforeLoad: () => requireRoleWorkspace(["OPS_MANAGER"]),
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
    <AdminShell workspace="operations">
      {query.isLoading ? <CaseSkeleton /> : null}
      {query.isError ? <CaseError message={query.error.message} /> : null}
      {query.data ? <CaseDetailView item={query.data} /> : null}
    </AdminShell>
  );
}

function CaseDetailView({ item }: { item: CaseDetail }) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <Link
        to="/operations/cases"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to operations
      </Link>

      <header className="ink-panel relative overflow-hidden rounded-[2rem] p-6 shadow-[var(--shadow-float)] sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]">
                {item.caseNumber}
              </span>
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
                {humanize(item.status)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{item.subject.fullName}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm opacity-70">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {item.client.displayName}
              </span>
              <span className="flex items-center gap-1.5">
                <ClipboardCheck className="h-4 w-4" />
                {item.checks.length} checks
              </span>
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4" />
                Due {item.dueAt ? formatDate(item.dueAt) : "not set"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="Priority" value={humanize(item.priority)} />
            <Metric
              label="Risk"
              value={item.riskLevel ? humanize(item.riskLevel) : "Unclassified"}
            />
          </div>
        </div>
      </header>

      <WorkflowStrip item={item} />
      <CaseActions item={item} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.75fr)]">
        <div className="space-y-5">
          <Panel title="Verification checks" subtitle="Current result and progress for each check">
            <div className="grid gap-3 sm:grid-cols-2">
              {item.checks.map((check) => (
                <CheckCard
                  key={check.publicId}
                  caseId={item.id}
                  caseStatus={item.status}
                  check={check}
                />
              ))}
            </div>
          </Panel>

          <DocumentPanel item={item} />

          <ClarificationPanel item={item} />

          <FieldVisitPanel item={item} />
        </div>

        <aside className="space-y-5">
          <CandidatePanel item={item} />

          <ConsentPanel item={item} />

          <ReportsPanel item={item} />

          <Panel title="Status history" subtitle="Immutable workflow transitions">
            <div className="space-y-4">
              {item.statusHistory.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="relative pl-6">
                  <span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/15" />
                  <p className="text-sm font-medium">{humanize(entry.toStatus)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 text-xs text-muted-foreground">{entry.reason}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
