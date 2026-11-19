import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Card, CardHeader, ErrorText, Loading, Th } from "@/kit";
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
    <Card label="Published report library">
      <CardHeader
        title="Published report library"
        description="Released reports, version history and authenticity checks."
        aside={
          <Link
            to="/client-portal/verifications"
            search={{ status: "PAYMENT_PENDING" }}
            className="text-xs font-semibold text-brand hover:underline"
          >
            Awaiting release →
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <ClientSearch
          value={input}
          onChange={setInput}
          onSubmit={() => filter(input)}
          label="Search reports"
          placeholder="Candidate or case number"
        />
        {search ? (
          <Button
            variant="ghost"
            onClick={() => {
              setInput("");
              filter("");
            }}
          >
            Clear search
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-dim" role="status">
          {reports.isFetching
            ? "Updating reports…"
            : reports.isError
              ? "Results unavailable"
              : `${reports.data?.items.length ?? 0} reports on this page`}
        </span>
      </div>
      {reports.isError ? (
        <ErrorText onRetry={() => void reports.refetch()} retrying={reports.isFetching}>
          {reports.error.message}
        </ErrorText>
      ) : null}
      {reports.isPending ? (
        <Loading>Loading reports…</Loading>
      ) : reports.data ? (
        <>
          {reports.data.items.length ? (
            <div className="overflow-x-auto" aria-busy={reports.isFetching}>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Published reports for your organisation</caption>
                <thead>
                  <tr>
                    <Th>Candidate / case</Th>
                    <Th>Published / version</Th>
                    <Th>Access</Th>
                    <Th align="right">Actions</Th>
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
          ) : (
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
    </Card>
  );
}
