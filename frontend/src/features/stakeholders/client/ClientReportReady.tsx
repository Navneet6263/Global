import { useMutation } from "@tanstack/react-query";
import { Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/kit";
import type { CaseListItem } from "@/lib/api/cases";
import { downloadReport } from "@/lib/backend-api/reports";
import { cn } from "@/lib/utils";
import { formatDate } from "./client-portal-utils";

type ReleasedReport = NonNullable<CaseListItem["report"]>;

function useReportDownload(report: ReleasedReport, caseNumber: string) {
  return useMutation({
    mutationFn: () => downloadReport(report.id, caseNumber),
    onError: (error: Error) =>
      toast.error("Report download failed", { description: error.message }),
  });
}

/** Where a case shows as completed: its final report, ready to download. */
export function ClientReportReady({
  report,
  caseNumber,
  className,
}: {
  report: ReleasedReport;
  caseNumber: string;
  className?: string;
}) {
  const download = useReportDownload(report, caseNumber);
  return (
    <section
      aria-label="Final report"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-good/25 bg-good-soft p-4",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-good ring-1 ring-good/25">
        <FileCheck2 className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Final report ready</p>
        <p className="text-xs text-dim">
          Version {report.version}
          {report.releasedAt ? ` · released ${formatDate(report.releasedAt)}` : ""}
          {report.downloadExpiresAt
            ? ` · download until ${formatDate(report.downloadExpiresAt)}`
            : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="primary"
        loading={download.isPending}
        onClick={() => download.mutate()}
      >
        <Download aria-hidden /> Download report
      </Button>
    </section>
  );
}

/** Compact version for list rows. */
export function ClientReportDownloadButton({
  report,
  caseNumber,
  candidateName,
  iconOnly = false,
}: {
  report: ReleasedReport;
  caseNumber: string;
  candidateName: string;
  /** Compact download icon for table rows. */
  iconOnly?: boolean;
}) {
  const download = useReportDownload(report, caseNumber);
  return (
    <Button
      size="sm"
      loading={download.isPending}
      onClick={() => download.mutate()}
      aria-label={`Download report for ${candidateName}`}
      title="Download final report"
      className={
        iconOnly
          ? "w-8 border-good/30 bg-good-soft px-0 text-good hover:brightness-95"
          : "border-good/30 text-good hover:bg-good-soft"
      }
    >
      <Download aria-hidden />
      {iconOnly ? null : " Report"}
    </Button>
  );
}
