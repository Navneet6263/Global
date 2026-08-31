import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BellRing, Files, LayoutDashboard, Plus, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, ListSkeleton } from "@/components/feedback/skeletons";
import { NewCaseDialog } from "@/components/ops/NewCaseDialog";
import { ClientActionCenter } from "@/features/stakeholders/client/ClientActionCenter";
import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { ClientInsights } from "@/features/stakeholders/client/ClientInsights";
import { ClientOverview, PortfolioTrustNote } from "@/features/stakeholders/client/ClientOverview";
import { ClientPortfolio } from "@/features/stakeholders/client/ClientPortfolio";
import { ClientWorkflow } from "@/features/stakeholders/client/ClientWorkflow";
import { StakeholderHeader, StakeholderShell } from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { listCases } from "@/lib/api/cases";
import { getExceptionsDashboard, getOperationsDashboard } from "@/lib/api/dashboards";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

interface ClientPortalSearch {
  caseId?: string;
}

export const Route = createFileRoute("/client-portal")({
  validateSearch: (search: Record<string, unknown>): ClientPortalSearch => ({
    caseId: typeof search["caseId"] === "string" ? search["caseId"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Client Portal — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["CLIENT_ADMIN"]),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const routeSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(routeSearch.caseId);
  useEffect(() => {
    if (routeSearch.caseId) setSelectedCaseId(routeSearch.caseId);
  }, [routeSearch.caseId]);
  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    void navigate({ search: (current) => ({ ...current, caseId }) });
  };
  const closeCase = () => {
    setSelectedCaseId(undefined);
    void navigate({ search: (current) => ({ ...current, caseId: undefined }), replace: true });
  };
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
  const actionCount = exceptions.data?.summary.clientActions ?? 0;
  const hasError = dashboard.isError || exceptions.isError || cases.isError;
  const isPending = dashboard.isPending || exceptions.isPending || cases.isPending;
  return (
    <StakeholderShell
      workspace="client-admin"
      hideGlobalCreate
      onRefresh={() => {
        void dashboard.refetch();
        void exceptions.refetch();
        void cases.refetch();
      }}
      refreshing={dashboard.isFetching || exceptions.isFetching || cases.isFetching}
    >
      <StakeholderHeader
        eyebrow={`${session.data?.clientName ?? "Client workspace"} · Secure portfolio`}
        title="Verification portfolio"
        description="Track every candidate, clear information requests and collect completed reports from one client-scoped workspace."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PortfolioTrustNote />
            {session.data?.permissions.includes("*") ||
            session.data?.permissions.includes("case:create") ? (
              <NewCaseDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:shadow-[var(--shadow-raise)]"
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
      {hasError ? (
        <ErrorState
          description={
            dashboard.error?.message ?? exceptions.error?.message ?? cases.error?.message
          }
          onRetry={() => {
            void dashboard.refetch();
            void exceptions.refetch();
            void cases.refetch();
          }}
          retrying={dashboard.isFetching || exceptions.isFetching || cases.isFetching}
        />
      ) : null}
      {isPending ? (
        <div className="space-y-5" aria-label="Loading verification portfolio">
          <CardGridSkeleton count={4} />
          <ListSkeleton rows={5} />
        </div>
      ) : (
        <>
          <div id="overview" className="scroll-mt-28 space-y-5">
            <ClientOverview operations={dashboard.data} exceptions={exceptions.data} />
            <ClientWorkflow data={dashboard.data} />
          </div>
          <ClientActionCenter data={exceptions.data} onOpen={openCase} />
          <ClientInsights data={dashboard.data} />
          <div id="verifications" className="scroll-mt-28">
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
              onOpen={openCase}
            />
          </div>
        </>
      )}
      {selectedCaseId ? (
        <ClientCaseDrawer
          caseId={selectedCaseId}
          canRespond={Boolean(session.data?.roles.includes("CLIENT_ADMIN"))}
          onClose={closeCase}
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
      className="sticky top-[4.5rem] z-20 flex gap-1 overflow-x-auto rounded-full border border-white/80 bg-card/90 p-1.5 shadow-[var(--shadow-card)] backdrop-blur-xl"
      aria-label="Client portal sections"
    >
      {items.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className="flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[11px] font-medium text-muted-foreground transition hover:bg-mint-soft hover:text-mint-deep"
        >
          <item.icon className="h-3.5 w-3.5" /> {item.label}
          {item.badge ? (
            <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold text-warning-foreground">
              {item.badge}
            </span>
          ) : null}
        </a>
      ))}
      <button
        type="button"
        onClick={onReports}
        className="flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[11px] font-medium text-muted-foreground transition hover:bg-mint-soft hover:text-mint-deep"
      >
        <ScrollText className="h-3.5 w-3.5" /> Completed reports
      </button>
    </nav>
  );
}
