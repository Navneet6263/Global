import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Button, CardHeader, ErrorText, Input, Loading, Segmented, Select, Th } from "@/kit";
import { listCases } from "@/lib/api/cases";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";
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

type QuickTab = "ALL" | "IN_PROGRESS" | "COMPLETED";

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
  const count = (value?: number) => (value !== undefined ? ` (${value})` : "");
  const all = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : undefined;
  const quick: QuickTab =
    search.status === "IN_PROGRESS" || search.status === "COMPLETED" ? search.status : "ALL";
  const shown = queueColumns.filter((column) => columns.includes(column.key));

  return (
    <section
      aria-label="Your verifications"
      className="min-w-0 rounded-lg border border-line bg-surface shadow-soft"
    >
      <CardHeader
        title="Your verifications"
        count={cases.data ? total : undefined}
        aside={
          <>
            {tools}
            <ClientQueueColumns columns={columns} onChange={updateColumns} />
          </>
        }
      />
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Quick case filters"
            value={search.status && quick === "ALL" ? ("" as QuickTab) : quick}
            onChange={(value) =>
              onChange({ status: value === "ALL" ? undefined : value, page: undefined })
            }
            options={[
              ["ALL", `All${count(all)}`],
              ["IN_PROGRESS", `In progress${count(counts?.["IN_PROGRESS"])}`],
              ["COMPLETED", `Completed${count(counts?.["COMPLETED"])}`],
            ]}
          />
          <Link
            to="/client-portal/actions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Needs action <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onChange({ q: input.trim() || undefined, page: undefined });
          }}
        >
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search candidate or case number</span>
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
              aria-hidden
            />
            <Input
              value={input}
              maxLength={120}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search candidate or case number"
              type="search"
              className="pr-20 pl-9"
            />
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              aria-label="Search"
              className="absolute top-1/2 right-1 h-7 -translate-y-1/2 text-brand"
            >
              Search
            </Button>
          </label>
          <Select
            aria-label="Filter case queue by stage"
            value={search.status ?? ""}
            className="w-auto min-w-[170px]"
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
          </Select>
          <Button
            variant="ghost"
            aria-label="Clear filters"
            onClick={() => {
              setInput("");
              onChange({ q: undefined, status: undefined, page: undefined });
            }}
          >
            Reset
          </Button>
        </form>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {waiting ? "Updating case queue…" : cases.isError ? "Case queue unavailable" : ""}
        {cases.isPlaceholderData ? " Showing previous results" : ""}
      </p>
      {cases.isError ? (
        <ErrorText onRetry={() => void cases.refetch()} retrying={waiting}>
          {cases.error.message}
        </ErrorText>
      ) : null}
      {cases.isPending ? <Loading>Loading your verifications…</Loading> : null}
      {cases.data && !cases.isError ? (
        <div aria-busy={waiting} className={cn(cases.isPlaceholderData && "opacity-60")}>
          {cases.data.items.length ? (
            <div
              className="overflow-x-auto"
              role="region"
              aria-label="Verification cases table"
              tabIndex={0}
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <Th>Candidate / Case</Th>
                    {shown.map((column) => (
                      <Th key={column.key}>{column.label}</Th>
                    ))}
                    <Th align="right">Action</Th>
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
              <p className="font-semibold text-ink">No cases found</p>
              <p className="mt-1 text-sm text-dim">
                {page > pages
                  ? "This page is no longer available. Return to the first page."
                  : "Try another filter, or create a new verification."}
              </p>
              {page > 1 ? (
                <Button className="mt-3" onClick={() => onChange({ page: undefined })}>
                  First page
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
        <span className="text-xs text-dim">
          {cases.data && !cases.isError && !cases.isPlaceholderData
            ? queueRange(page, cases.data.items.length, total, pageSize)
            : cases.isError
              ? "Results unavailable"
              : "Loading results…"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            aria-label="Previous"
            disabled={page <= 1 || waiting}
            onClick={() => onChange({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-dim">
            Page {page} / {pages}
          </span>
          <Button
            size="sm"
            aria-label="Next"
            disabled={page >= pages || waiting || cases.isError}
            onClick={() => onChange({ page: page + 1 })}
          >
            Next
          </Button>
          <Select
            aria-label="Rows per page"
            value={pageSize}
            className="h-8 w-auto text-xs"
            onChange={(event) =>
              onChange({ pageSize: Number(event.target.value), page: undefined })
            }
          >
            <option value={6}>6 per page</option>
            <option value={12}>12 per page</option>
          </Select>
        </div>
      </footer>
    </section>
  );
}
