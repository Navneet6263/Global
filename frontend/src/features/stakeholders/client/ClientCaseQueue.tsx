import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { listCases } from "@/lib/api/cases";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { ClientQueueRow } from "./ClientQueueRow";
import { ClientQueueColumns } from "./ClientQueueColumns";
import { queueColumns, useQueueColumns } from "./client-queue-columns";
import {
  CLIENT_PAGE_SIZE,
  clientQueueQuery,
  clientStages,
  queueRange,
  type ClientQueueSearch,
} from "./client-queue-model";

export function ClientCaseQueue({
  search,
  counts,
  tools,
  onChange,
  onOpen,
}: {
  search: ClientQueueSearch;
  counts?: OperationsDashboard["statusMix"];
  tools?: ReactNode;
  onChange: (patch: Partial<ClientQueueSearch>, replace?: boolean) => void;
  onOpen: (caseId: string) => void;
}) {
  const [input, setInput] = useState(search.q ?? "");
  const { columns, update: updateColumns } = useQueueColumns();
  useEffect(() => setInput(search.q ?? ""), [search.q]);
  const query = clientQueueQuery(search);
  const cases = useQuery({
    queryKey: ["cases", "client-queue", query],
    queryFn: ({ signal }) => listCases(query, signal),
    placeholderData: keepPreviousData,
  });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? CLIENT_PAGE_SIZE;
  const total = cases.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const waiting = cases.isFetching;
  const tabs = [
    {
      label: "All",
      status: undefined,
      count: counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : undefined,
    },
    { label: "In progress", status: "IN_PROGRESS", count: counts?.["IN_PROGRESS"] },
    { label: "Completed", status: "COMPLETED", count: counts?.["COMPLETED"] },
  ];
  return (
    <section className="client-panel client-queue" aria-label="Your verifications">
      <header className="client-queue-heading">
        <h2>Your verifications</h2>
        <div className="flex items-center gap-2">
          {tools}
          <ClientQueueColumns columns={columns} onChange={updateColumns} />
        </div>
      </header>
      <div className="client-queue-tabs" role="group" aria-label="Quick case filters">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-pressed={search.status === tab.status}
            onClick={() => onChange({ status: tab.status, page: undefined })}
          >
            {tab.label}
            {tab.count !== undefined ? ` (${tab.count})` : ""}
          </button>
        ))}
        <Link to="/client-portal/actions">Needs action ↗</Link>
      </div>
      <form
        className="client-queue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ q: input.trim() || undefined, page: undefined });
        }}
      >
        <label className="client-queue-search">
          <span className="sr-only">Search candidate or case number</span>
          <input
            value={input}
            maxLength={120}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search candidate or case number"
            type="search"
          />
          <button type="submit" aria-label="Search">
            <Search aria-hidden />
          </button>
        </label>
        <select
          aria-label="Filter case queue by stage"
          value={search.status ?? ""}
          onChange={(event) =>
            onChange({ status: event.target.value || undefined, page: undefined })
          }
        >
          <option value="">All statuses</option>
          {clientStages.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Clear filters"
          className="client-filter-reset"
          onClick={() => {
            setInput("");
            onChange({ q: undefined, status: undefined, page: undefined });
          }}
        >
          Reset
        </button>
      </form>
      <div className="client-queue-feedback" role="status" aria-live="polite">
        {waiting ? "Updating case queue…" : cases.isError ? "Case queue unavailable" : ""}
        {cases.isPlaceholderData ? " Showing previous results" : ""}
      </div>
      {cases.isError ? (
        <ErrorState
          description={cases.error.message}
          onRetry={() => void cases.refetch()}
          retrying={waiting}
        />
      ) : null}
      {cases.isPending ? <ListSkeleton rows={6} /> : null}
      {cases.data && !cases.isError ? (
        <div aria-busy={waiting} className={cases.isPlaceholderData ? "opacity-60" : undefined}>
          {cases.data.items.length ? (
            <div
              className="client-table-scroll"
              role="region"
              aria-label="Verification cases table"
              tabIndex={0}
            >
              <table className="client-case-table">
                <thead>
                  <tr>
                    <th scope="col">Candidate / Case</th>
                    {queueColumns
                      .filter((column) => columns.includes(column.key))
                      .map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.data.items.map((item) => (
                    <ClientQueueRow
                      key={item.id}
                      item={item}
                      columns={columns}
                      disabled={cases.isPlaceholderData}
                      onOpen={() => onOpen(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="font-semibold">No cases found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {page > pages
                  ? "This page is no longer available. Return to the first page."
                  : "Try another filter, or create a new verification."}
              </p>
              {page > 1 ? (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => onChange({ page: undefined })}
                >
                  First page
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <footer className="client-queue-footer">
        <span>
          {cases.data && !cases.isError && !cases.isPlaceholderData
            ? queueRange(page, cases.data.items.length, total, pageSize)
            : cases.isError
              ? "Results unavailable"
              : "Loading results…"}
        </span>
        <div className="client-pagination">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            disabled={page <= 1 || waiting}
            onClick={() => onChange({ page: page - 1 })}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span>
            Page {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            disabled={page >= pages || waiting || cases.isError}
            onClick={() => onChange({ page: page + 1 })}
          >
            <ChevronRight aria-hidden />
          </Button>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) =>
              onChange({ pageSize: Number(event.target.value), page: undefined })
            }
          >
            <option value={6}>6 per page</option>
            <option value={12}>12 per page</option>
          </select>
        </div>
      </footer>
    </section>
  );
}
