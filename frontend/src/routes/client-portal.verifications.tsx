import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ClientCaseDrawer } from "@/features/stakeholders/client/ClientCaseDrawer";
import { ClientPortfolio } from "@/features/stakeholders/client/ClientPortfolio";
import { ClientWorkspaceHeader } from "@/features/stakeholders/client/ClientWorkspaceHeader";
import { listCases } from "@/lib/api/cases";

interface VerificationSearch {
  caseId?: string;
}

export const Route = createFileRoute("/client-portal/verifications")({
  validateSearch: (search: Record<string, unknown>): VerificationSearch => ({
    caseId: typeof search["caseId"] === "string" ? search["caseId"] : undefined,
  }),
  head: () => ({ meta: [{ title: "Verifications — Sapling Global" }] }),
  component: ClientVerificationsPage,
});

function ClientVerificationsPage() {
  const routeSearch = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(routeSearch.caseId);
  useEffect(() => {
    if (routeSearch.caseId) setSelectedCaseId(routeSearch.caseId);
  }, [routeSearch.caseId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const cases = useQuery({
    queryKey: ["cases", "client-portal", search, status, cursor],
    queryFn: () => listCases({ search, status, limit: 25, ...(cursor ? { cursor } : {}) }),
  });
  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    void navigate({ search: (current) => ({ ...current, caseId }) });
  };

  return (
    <>
      <ClientWorkspaceHeader
        title="Verifications"
        description="Search every candidate, inspect the current stage and follow progress without leaving your organisation scope."
        allowCreate
      />
      {cases.isPending ? <ListSkeleton rows={7} /> : null}
      {cases.isError ? (
        <ErrorState
          description={cases.error.message}
          onRetry={() => void cases.refetch()}
          retrying={cases.isFetching}
        />
      ) : null}
      {cases.data ? (
        <ClientPortfolio
          items={cases.data.items}
          search={searchInput}
          status={status}
          page={history.length + 1}
          hasPrevious={history.length > 0}
          hasNext={Boolean(cases.data.nextCursor)}
          onSearch={setSearchInput}
          onStatus={(value) => {
            setStatus(value);
            setCursor(undefined);
            setHistory([]);
          }}
          onPrevious={() => {
            const previous = [...history];
            setCursor(previous.pop());
            setHistory(previous);
          }}
          onNext={() => {
            if (!cases.data.nextCursor) return;
            setHistory((current) => [...current, cursor]);
            setCursor(cases.data.nextCursor ?? undefined);
          }}
          onOpen={openCase}
        />
      ) : null}
      {selectedCaseId ? (
        <ClientCaseDrawer
          caseId={selectedCaseId}
          canRespond
          onClose={() => {
            setSelectedCaseId(undefined);
            void navigate({
              search: (current) => ({ ...current, caseId: undefined }),
              replace: true,
            });
          }}
        />
      ) : null}
    </>
  );
}
