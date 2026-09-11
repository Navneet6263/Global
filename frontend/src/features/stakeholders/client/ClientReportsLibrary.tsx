import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronLeft, ChevronRight, Download, FileCheck2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Section } from "@/components/layout/section";
import { downloadReport, listPublishedReports } from "@/lib/api/reports";
import { formatDate } from "./client-portal-utils";

export function ClientReportsLibrary() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const reports = useQuery({
    queryKey: ["reports", "published", search, cursor],
    queryFn: () => listPublishedReports({ search, cursor, limit: 20 }),
  });
  const download = useMutation({
    mutationFn: ({ reportId, caseNumber }: { reportId: string; caseNumber: string }) =>
      downloadReport(reportId, caseNumber),
    onError: (error) => toast.error("Report download failed", { description: error.message }),
  });

  if (reports.isPending) return <ListSkeleton rows={6} />;
  if (reports.isError) {
    return (
      <ErrorState
        title="Reports could not be loaded"
        description={reports.error.message}
        onRetry={() => void reports.refetch()}
        retrying={reports.isFetching}
      />
    );
  }
  const items = reports.data.items;
  return (
    <Section
      title="Published report library"
      description="Released reports available only within your authorised scope"
      padded={false}
    >
      <div className="border-b border-border bg-card/45 p-4">
        <label className="relative block max-w-xl">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search candidate or case number"
            className="h-10 w-full rounded-full border border-border bg-muted/45 pl-9 pr-3 text-sm outline-none transition focus:border-primary/45 focus:bg-card focus:ring-4 focus:ring-primary/8"
          />
        </label>
      </div>
      <div className="divide-y divide-border/70">
        {items.map((report) => (
          <article
            key={report.id}
            className="grid gap-4 px-5 py-4 transition hover:bg-mint-soft/30 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_auto] lg:items-center"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-success-soft text-success-foreground">
                <FileCheck2 className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{report.case.subject.fullName}</p>
                <p className="num mt-0.5 text-[10px] text-muted-foreground">
                  {report.case.caseNumber}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Published
              </p>
              <p className="mt-1 text-xs font-medium">
                {report.publishedAt ? formatDate(report.publishedAt) : "Processing"}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Released version
              </p>
              <p className="num mt-1 text-xs font-medium">
                v{report.latestVersion?.version ?? report.currentVersion}
                {report.latestVersion ? ` · ${report.latestVersion.authenticityCode}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {report.latestVersion ? (
                <a
                  href={`/reports/verify/${encodeURIComponent(report.latestVersion.authenticityCode)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-[10px] font-semibold text-muted-foreground transition hover:border-success/30 hover:text-success-foreground"
                >
                  <BadgeCheck className="size-3.5" aria-hidden /> Verify
                </a>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  download.mutate({ reportId: report.id, caseNumber: report.case.caseNumber })
                }
                disabled={download.isPending}
                aria-busy={download.isPending && download.variables?.reportId === report.id}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3 text-[10px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Download className="size-3.5" aria-hidden /> Download PDF
              </button>
            </div>
          </article>
        ))}
        {!items.length ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold">No published report found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Reports appear here after quality review, manager approval and payment-controlled
              release.
            </p>
          </div>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="num text-[11px] text-muted-foreground">Page {history.length + 1}</span>
        <div className="flex gap-2">
          <PageButton
            label="Previous report page"
            disabled={!history.length}
            icon={ChevronLeft}
            onClick={() => {
              const previous = [...history];
              setCursor(previous.pop());
              setHistory(previous);
            }}
          />
          <PageButton
            label="Next report page"
            disabled={!reports.data.nextCursor}
            icon={ChevronRight}
            onClick={() => {
              if (!reports.data.nextCursor) return;
              setHistory((current) => [...current, cursor]);
              setCursor(reports.data.nextCursor ?? undefined);
            }}
          />
        </div>
      </footer>
    </Section>
  );
}

function PageButton({
  label,
  disabled,
  icon: Icon,
  onClick,
}: {
  label: string;
  disabled: boolean;
  icon: typeof ChevronLeft;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground disabled:opacity-35"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
