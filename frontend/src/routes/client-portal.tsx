import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  MessageCircleQuestion,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { NewCaseDialog } from "@/components/ops/NewCaseDialog";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientPortfolio } from "@/features/stakeholders/client/ClientPortfolio";
import {
  StakeholderHeader,
  StakeholderKpis,
  StakeholderShell,
} from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { listCases } from "@/lib/api/cases";
import { getOperationsDashboard } from "@/lib/api/dashboards";

export const Route = createFileRoute("/client-portal")({
  head: () => ({ meta: [{ title: "Client Portal — Sapling Global" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setCursorHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const dashboard = useQuery({
    queryKey: ["dashboard", "client"],
    queryFn: getOperationsDashboard,
  });
  const cases = useQuery({
    queryKey: ["cases", "client-portal", search, status, cursor],
    queryFn: () => listCases({ search, status, limit: 25, ...(cursor ? { cursor } : {}) }),
  });
  const data = dashboard.data;
  const rows = cases.data?.items ?? [];
  const completed = (data?.statusMix["COMPLETED"] ?? 0) + (data?.statusMix["CLOSED"] ?? 0);
  const active = Math.max(
    0,
    (data?.summary.total ?? 0) - completed - (data?.statusMix["CANCELLED"] ?? 0),
  );
  const clarification = data?.statusMix["CLARIFICATION_PENDING"] ?? 0;
  const overdue = data?.summary.overdue ?? 0;
  const total = data?.summary.total ?? 0;
  return (
    <StakeholderShell
      onRefresh={() => {
        void dashboard.refetch();
        void cases.refetch();
      }}
      refreshing={dashboard.isFetching || cases.isFetching}
    >
      <StakeholderHeader
        eyebrow="Stakeholders / Client"
        title="Verification portfolio"
        description="Track every authorised candidate, turnaround commitment and verification outcome from one clear workspace."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {session.data?.displayName ?? "Authorised client user"}
            </div>
            {session.data?.permissions.includes("*") ||
            session.data?.permissions.includes("case:create") ? (
              <NewCaseDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> New verification
                  </button>
                }
              />
            ) : null}
          </div>
        }
      />
      {dashboard.isError || cases.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dashboard.error?.message ?? cases.error?.message}
        </div>
      ) : null}
      <StakeholderKpis
        items={[
          {
            label: "Portfolio",
            value: total,
            detail: `${active} cases currently active`,
            icon: BriefcaseBusiness,
            tone: "blue",
            progress: ratio(active, total),
          },
          {
            label: "Completed",
            value: completed,
            detail: `${data?.summary.completedToday ?? 0} completed today`,
            icon: CheckCircle2,
            tone: "emerald",
            progress: ratio(completed, total),
          },
          {
            label: "Awaiting action",
            value: clarification,
            detail: "Clarifications needing response",
            icon: MessageCircleQuestion,
            tone: "orange",
            progress: ratio(clarification, total),
          },
          {
            label: "SLA overdue",
            value: overdue,
            detail: overdue ? "Requires immediate attention" : "Portfolio currently on track",
            icon: AlertTriangle,
            tone: overdue ? "red" : "emerald",
            progress: ratio(overdue, total),
          },
        ]}
      />
      <ClientInsights data={data} />
      <ClientPortfolio
        items={rows}
        search={searchInput}
        status={status}
        page={cursorHistory.length + 1}
        hasPrevious={cursorHistory.length > 0}
        hasNext={Boolean(cases.data?.nextCursor)}
        onSearch={setSearchInput}
        onStatus={(value) => {
          setStatus(value);
          setCursor(undefined);
          setCursorHistory([]);
        }}
        onPrevious={() => {
          const history = [...cursorHistory];
          setCursor(history.pop());
          setCursorHistory(history);
        }}
        onNext={() => {
          const next = cases.data?.nextCursor;
          if (!next) return;
          setCursorHistory((current) => [...current, cursor]);
          setCursor(next);
        }}
        onOpen={setSelectedCaseId}
      />
      {selectedCaseId ? (
        <ClientCaseDrawer
          caseId={selectedCaseId}
          canRespond={Boolean(session.data?.roles.includes("CLIENT_ADMIN"))}
          onClose={() => setSelectedCaseId(undefined)}
        />
      ) : null}
    </StakeholderShell>
  );
}

function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
