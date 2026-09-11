import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, Search } from "lucide-react";
import { getQaHistory } from "@/lib/backend-api/qa-register";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button } from "@/components/ui/button";
import { WorkspaceEmpty, WorkspaceError, WorkspaceLoading } from "../WorkspaceStates";
import { formatDate, humanize } from "../utils";

export function QaHistory() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 250);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search]);
  const query = useQuery({
    queryKey: ["qa", "history", search, page],
    queryFn: ({ signal }) => getQaHistory({ search, page, limit: 10 }, signal),
    placeholderData: keepPreviousData,
    enabled: search === searchInput.trim(),
  });
  return (
    <section className="rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">My decision history</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your recorded decisions · current case and report status shown separately
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-full border bg-white px-3 py-2">
          <Search className="size-4 text-muted-foreground" aria-hidden />
          <input
            aria-label="Search decision history"
            placeholder="Candidate, case or client"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="min-w-0 bg-transparent text-xs outline-none"
          />
        </label>
      </header>
      {query.isFetching ? (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          Updating decision history…
        </p>
      ) : null}
      {query.isPending ? <WorkspaceLoading label="Loading your decision history" /> : null}
      {query.isError ? (
        <WorkspaceError message={query.error.message} onRetry={() => void query.refetch()} />
      ) : null}
      {query.data && !query.isError ? (
        <>
          <div className="mt-5 space-y-3">
            {query.data.items.map((entry) => {
              const approved = entry.decision === "APPROVED";
              const Icon = approved ? CheckCircle2 : RotateCcw;
              return (
                <article
                  key={entry.publicId}
                  className="rounded-2xl border border-border/60 bg-background/55 p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-2xl ${approved ? "bg-mint-soft text-mint-deep" : "bg-amber-50 text-amber-800"}`}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{entry.case.subject.fullName}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.case.caseNumber} · {entry.case.client.displayName}
                      </p>
                    </div>
                    <div className="text-xs">
                      <p className="font-medium">{humanize(entry.decision)}</p>
                      <time className="mt-1 block text-muted-foreground" dateTime={entry.createdAt}>
                        {formatDate(entry.createdAt)}
                      </time>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {entry.notes || "No rationale recorded"}
                  </p>
                  <footer className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    <span>
                      Current stage:{" "}
                      <strong className="font-medium text-foreground">
                        {humanize(entry.case.status)}
                      </strong>
                    </span>
                    <span>
                      Latest report:{" "}
                      <strong className="font-medium text-foreground">
                        {entry.case.reports[0]
                          ? `${humanize(entry.case.reports[0].status)}${entry.case.reports[0].currentVersion > 0 ? ` · v${entry.case.reports[0].currentVersion}` : ""}`
                          : "Not generated"}
                      </strong>
                    </span>
                  </footer>
                </article>
              );
            })}
            {!query.data.items.length ? (
              <WorkspaceEmpty
                title="No decisions found"
                detail="Approved and returned cases appear here after your decision is saved."
              />
            ) : null}
          </div>
          <footer className="mt-5 flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
            <span>
              {query.data.total} decisions · Page {page} of{" "}
              {Math.max(1, Math.ceil(query.data.total / 10))}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1 || query.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * 10 >= query.data.total || query.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </footer>
        </>
      ) : null}
    </section>
  );
}
