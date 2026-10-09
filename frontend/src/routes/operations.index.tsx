import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { getSession } from "@/lib/api/auth";
import { listAllClients } from "@/lib/api/cases";
import { getExecutiveDashboard, getOperationsDashboard } from "@/lib/api/dashboards";
import { listAllUsers } from "@/lib/backend-api/users";
import { OpsMetricsStrip } from "@/features/operations/workspace/OpsMetricsStrip";
import { OpsWorkQueue } from "@/features/operations/workspace/OpsWorkQueue";
import { OpsCaseContext } from "@/features/operations/workspace/OpsCaseContext";
import { OpsPerformance } from "@/features/operations/workspace/OpsPerformance";
import {
  AssignRmDialog,
  EscalateDialog,
  type CaseTarget,
} from "@/features/operations/workspace/OpsCaseDialogs";
import { navigationCountsQuery } from "@/features/operations/workspace/ops-workspace-api";
import {
  istDateTime,
  opsQueueViews,
  parseOpsQueueSearch,
  type OpsQueueSearch,
} from "@/features/operations/workspace/ops-queue-model";

export const Route = createFileRoute("/operations/")({
  validateSearch: parseOpsQueueSearch,
  head: () => ({
    meta: [
      { title: "Operations overview — Sapling Global" },
      {
        name: "description",
        content:
          "Operations work queue: responsible RMs, current owners, blockers and next actions.",
      },
    ],
  }),
  component: OperationsOverview,
});

type Dialog = { kind: "rm" | "escalate"; target: CaseTarget };

function OperationsOverview() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [dialog, setDialog] = useState<Dialog>();
  const [months, setMonths] = useState(3);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const can = (permission: string) =>
    Boolean(session.data?.permissions.some((p) => p === "*" || p === permission));
  const canManage = can("case:transition");
  const counts = useQuery(navigationCountsQuery);
  const dashboard = useQuery({
    queryKey: ["dashboard", "operations", "summary"],
    queryFn: getOperationsDashboard,
    enabled: can("dashboard:read"),
  });
  const performance = useQuery({
    queryKey: ["dashboard", "executive", "operations", months],
    queryFn: () => getExecutiveDashboard({ months }),
    enabled: can("dashboard:read"),
    staleTime: 60_000,
  });
  const clients = useQuery({
    queryKey: ["clients", "all"],
    queryFn: () => listAllClients(),
    enabled: can("client:read"),
    staleTime: 5 * 60_000,
  });
  const rms = useQuery({
    queryKey: ["users", "SPOC_RM", "all"],
    queryFn: () => listAllUsers("SPOC_RM"),
    enabled: can("user:read"),
    staleTime: 60_000,
  });
  const update = (patch: Partial<OpsQueueSearch>, replace = false) => {
    void navigate({ search: (current) => ({ ...current, ...patch }), replace, resetScroll: false });
  };
  const viewLabel = opsQueueViews.find((item) => item.value === search.view)?.label;

  return (
    <>
      <header className="client-heading">
        <div>
          <h1>{viewLabel ? `Operations · ${viewLabel}` : "Operations overview"}</h1>
          <p>Your cases, owners and next actions.</p>
        </div>
        <p className="ops-updated" aria-live="polite">
          {counts.dataUpdatedAt
            ? `Updated ${istDateTime(new Date(counts.dataUpdatedAt).toISOString())}`
            : "Loading…"}
        </p>
      </header>
      {counts.isError ? (
        <ErrorState
          description={counts.error.message}
          onRetry={() => void counts.refetch()}
          retrying={counts.isFetching}
        />
      ) : null}
      <OpsMetricsStrip
        counts={counts.data?.counts}
        dashboard={dashboard.data}
        onTime={performance.data?.performance.slaPercentage}
      />
      <div className="client-workspace-grid ops-workspace-grid">
        <OpsWorkQueue
          search={search}
          counts={counts.data?.counts}
          clients={(clients.data ?? []).map((client) => ({
            value: client.publicId,
            label: client.displayName,
          }))}
          rms={(rms.data?.items ?? []).map((user) => ({
            value: user.id,
            label: user.displayName,
          }))}
          canAssign={canManage}
          onChange={update}
          onFocus={(caseId) => update({ caseId }, true)}
          onAssign={(item) =>
            setDialog({
              kind: "rm",
              target: {
                id: item.id,
                caseNumber: item.caseNumber,
                candidate: item.subject.fullName,
                clientId: item.client.publicId,
                clientName: item.client.displayName,
                version: item.version,
                ownerId: item.assignedOpsUser?.publicId,
                ownerName: item.assignedOpsUser?.displayName,
              },
            })
          }
        />
        <OpsCaseContext
          caseId={search.caseId}
          canManage={canManage}
          onClose={() => update({ caseId: undefined }, true)}
          onChangeRm={(item) => setDialog({ kind: "rm", target: targetOf(item) })}
          onEscalate={(item) => setDialog({ kind: "escalate", target: targetOf(item) })}
        />
      </div>
      {can("dashboard:read") ? (
        <OpsPerformance
          data={performance.data}
          loading={performance.isPending}
          error={performance.isError ? performance.error.message : undefined}
          retrying={performance.isFetching}
          onRetry={() => void performance.refetch()}
          months={months}
          onMonths={setMonths}
        />
      ) : null}
      <p className="client-report-note">
        <CircleHelp className="size-3" aria-hidden />
        Operations assigns and changes RMs. Verification outcomes, QC approval and report release
        stay with their owning teams.
      </p>
      {dialog?.kind === "rm" ? (
        <AssignRmDialog
          target={dialog.target}
          users={rms.data?.items ?? []}
          loading={rms.isPending && rms.fetchStatus !== "idle"}
          error={
            rms.isError
              ? rms.error.message
              : !can("user:read")
                ? "You do not have access to the user directory."
                : undefined
          }
          onClose={() => setDialog(undefined)}
        />
      ) : null}
      {dialog?.kind === "escalate" ? (
        <EscalateDialog target={dialog.target} onClose={() => setDialog(undefined)} />
      ) : null}
    </>
  );
}

function targetOf(item: {
  id: string;
  caseNumber: string;
  version: number;
  subject: { fullName: string };
  client: { publicId: string; displayName: string };
  assignedOpsUser?: { publicId: string; displayName: string } | null;
}): CaseTarget {
  return {
    id: item.id,
    caseNumber: item.caseNumber,
    candidate: item.subject.fullName,
    clientId: item.client.publicId,
    clientName: item.client.displayName,
    version: item.version,
    ownerId: item.assignedOpsUser?.publicId,
    ownerName: item.assignedOpsUser?.displayName,
  };
}
