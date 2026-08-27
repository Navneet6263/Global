import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Files, LayoutDashboard, Plus, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { ClientActionCenter } from "@/features/stakeholders/client/ClientActionCenter";
import { NewCaseDialog } from "@/components/ops/NewCaseDialog";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientOverview, PortfolioTrustNote } from "@/features/stakeholders/client/ClientOverview";
import { ClientPortfolio } from "@/features/stakeholders/client/ClientPortfolio";
import { ClientWorkflow } from "@/features/stakeholders/client/ClientWorkflow";
import { StakeholderHeader, StakeholderShell } from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { listCases } from "@/lib/api/cases";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";

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
  const exceptions = useQuery({
    queryKey: ["dashboard", "client", "actions"],
    queryFn: getExceptionsDashboard,
  });
  const cases = useQuery({
    queryKey: ["cases", "client-portal", search, status, cursor],
    queryFn: () => listCases({ search, status, limit: 25, ...(cursor ? { cursor } : {}) }),
  });
  const rows = cases.data?.items ?? [];
  const actionCount =
    exceptions.data?.clarifications.filter((item) => item.status === "OPEN").length ?? 0;
  return (
    <StakeholderShell
      hideGlobalCreate
      onRefresh={() => {
        void dashboard.refetch();
        void exceptions.refetch();
        void cases.refetch();
      }}
      refreshing={dashboard.isFetching || exceptions.isFetching || cases.isFetching}
    >
      <StakeholderHeader
        eyebrow={`${session.data?.clientName ?? "Client"} / Verification workspace`}
        title="Your verification portfolio"
        description="Monitor progress, resolve document requests and access completed reports without chasing updates."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PortfolioTrustNote />
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
      <PortalSectionNav
        actionCount={actionCount}
        onReports={() => {
          setStatus("COMPLETED");
          setCursor(undefined);
          setCursorHistory([]);
          window.setTimeout(
            () => document.getElementById("verifications")?.scrollIntoView({ behavior: "smooth" }),
            0,
          );
        }}
      />
      {dashboard.isError || exceptions.isError || cases.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {dashboard.error?.message ?? exceptions.error?.message ?? cases.error?.message}
        </div>
      ) : null}
      <div id="overview" className="scroll-mt-24 space-y-5">
        <ClientOverview operations={dashboard.data} exceptions={exceptions.data} />
        <ClientWorkflow data={dashboard.data} />
      </div>
      <ClientActionCenter data={exceptions.data} onOpen={setSelectedCaseId} />
      <ClientInsights data={dashboard.data} />
      <div id="verifications" className="scroll-mt-24">
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
      </div>
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

function PortalSectionNav({
  actionCount,
  onReports,
}: {
  actionCount: number;
  onReports: () => void;
}) {
  const items = [
    { label: "Overview", href: "#overview", icon: LayoutDashboard },
    { label: "Action required", href: "#actions", icon: BellRing, badge: actionCount },
    { label: "Verifications", href: "#verifications", icon: Files },
  ];
  return (
    <nav
      className="sticky top-[4.5rem] z-20 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl"
      aria-label="Client portal sections"
    >
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <item.icon className="h-3.5 w-3.5" /> {item.label}
          {item.badge ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] text-amber-800">
              {item.badge}
            </span>
          ) : null}
        </a>
      ))}
      <button
        type="button"
        onClick={onReports}
        className="flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
      >
        <ScrollText className="h-3.5 w-3.5" /> Completed reports
      </button>
    </nav>
  );
}
