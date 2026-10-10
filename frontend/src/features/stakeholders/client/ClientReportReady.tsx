import { useMutation } from "@tanstack/react-query";
import { Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
        "flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-600 ring-1 ring-emerald-200">
        <FileCheck2 className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-emerald-900">Final report ready</p>
        <p className="text-xs text-emerald-800/80">
          Version {report.version}
          {report.releasedAt ? ` · released ${formatDate(report.releasedAt)}` : ""}
          {report.downloadExpiresAt
            ? ` · download until ${formatDate(report.downloadExpiresAt)}`
            : ""}
        </p>
      </div>
      <Button size="sm" loading={download.isPending} onClick={() => download.mutate()}>
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
}: {
  report: ReleasedReport;
  caseNumber: string;
  candidateName: string;
}) {
  const download = useReportDownload(report, caseNumber);
  return (
    <Button
      size="sm"
      variant="outline"
      loading={download.isPending}
      onClick={() => download.mutate()}
      aria-label={`Download report for ${candidateName}`}
      className="w-full justify-center border-emerald-200 text-emerald-700 hover:bg-emerald-50"
    >
      <Download aria-hidden /> Report
    </Button>
  );
}
