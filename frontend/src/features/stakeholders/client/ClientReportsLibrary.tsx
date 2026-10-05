import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { listPublishedReports } from "@/lib/api/reports";
import { ClientEmpty, ClientPager, ClientSearch } from "./ClientPageParts";
import { ClientReportRow } from "./ClientReportRow";

export function ClientReportsLibrary() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const reports = useQuery({
    queryKey: ["reports", "published", search, cursor, 8],
    queryFn: () => listPublishedReports({ search, cursor, limit: 8 }),
    placeholderData: keepPreviousData,
  });
  const filter = (value: string) => {
    setSearch(value.trim());
    setCursor(undefined);
    setHistory([]);
  };
  return (
    <section className="client-register" aria-label="Published report library">
      <div className="client-register-title">
        <div>
          <h2>Published report library</h2>
          <p>Released reports, version history and authenticity checks.</p>
        </div>
        <Link
          to="/client-portal/verifications"
          search={{ status: "PAYMENT_PENDING" }}
          className="client-text-link"
        >
          Awaiting release →
        </Link>
      </div>
      <div className="client-register-toolbar">
        <ClientSearch
          value={input}
          onChange={setInput}
          onSubmit={() => filter(input)}
          label="Search reports"
          placeholder="Candidate or case number"
        />
        {search && (
          <Button
            variant="ghost"
            onClick={() => {
              setInput("");
              filter("");
            }}
          >
            Clear search
          </Button>
        )}
        <span className="client-register-meta" role="status">
          {reports.isFetching
            ? "Updating reports…"
            : reports.isError
              ? "Results unavailable"
              : `${reports.data?.items.length ?? 0} reports on this page`}
        </span>
      </div>
      {reports.isError && (
        <ErrorState
          description={reports.error.message}
          onRetry={() => void reports.refetch()}
          retrying={reports.isFetching}
        />
      )}
      {reports.isPending ? (
        <ListSkeleton rows={5} />
      ) : reports.data ? (
        <>
          <div className="client-register-scroll" aria-busy={reports.isFetching}>
            <table>
              <caption className="sr-only">Published reports for your organisation</caption>
              <thead>
                <tr>
                  {["Candidate / case", "Published / version", "Access", "Actions"].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.data.items.map((report) => (
                  <ClientReportRow
                    key={report.id}
                    report={report}
                    stale={reports.isPlaceholderData}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {!reports.data.items.length && (
            <ClientEmpty title="No published reports found">
              {search
                ? "Try another candidate or clear your search."
                : "Reports appear after quality review, manager approval and authorised release."}
            </ClientEmpty>
          )}
        </>
      ) : null}
      <ClientPager
        page={history.length + 1}
        previous={!!history.length}
        next={!!reports.data?.nextCursor}
        busy={reports.isFetching || reports.isError}
        detail="Only released reports in your organisation are listed."
        onPrevious={() => {
          const previous = [...history];
          setCursor(previous.pop());
          setHistory(previous);
        }}
        onNext={() => {
          if (!reports.data?.nextCursor) return;
          setHistory((current) => [...current, cursor]);
          setCursor(reports.data.nextCursor);
        }}
      />
    </section>
  );
}
