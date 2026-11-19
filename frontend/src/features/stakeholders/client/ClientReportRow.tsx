import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Chip, Td, buttonClass } from "@/kit";
import { downloadReport, type PublishedReportSummary } from "@/lib/backend-api/reports";
import { formatDate } from "./client-portal-utils";

export function ClientReportRow({
  report,
  stale,
}: {
  report: PublishedReportSummary;
  stale: boolean;
}) {
  const download = useMutation({
    mutationFn: () => downloadReport(report.id, report.case.caseNumber),
    onError: (error: Error) =>
      toast.error("Report download failed", { description: error.message }),
  });
  const expired = report.downloadExpiresAt
    ? Date.parse(report.downloadExpiresAt) <= Date.now()
    : false;
  const unavailable = report.canDownload === false || expired;
  return (
    <tr className="last:[&>td]:border-b-0 hover:bg-subtle/40">
      <Td>
        <div className="flex min-w-[180px] items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-good-soft text-good">
            <FileCheck2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <strong className="block truncate font-semibold text-ink">
              {report.case.subject.fullName}
            </strong>
            <small className="font-mono text-xs text-dim">{report.case.caseNumber}</small>
          </div>
        </div>
      </Td>
      <Td className="whitespace-nowrap">
        <span className="text-ink">
          {report.publishedAt ? formatDate(report.publishedAt) : "Not recorded"}
        </span>
        <small className="block text-xs text-dim">
          Version {report.latestVersion?.version ?? report.currentVersion}
        </small>
      </Td>
      <Td>
        <Chip tone={unavailable ? "warn" : "good"} dot>
          {unavailable ? "Access unavailable" : "Released"}
        </Chip>
        <small className="mt-1 block text-xs text-dim">
          {report.downloadExpiresAt
            ? `Access until ${formatDate(report.downloadExpiresAt)}`
            : "Authorised client access"}
        </small>
      </Td>
      <Td align="right">
        <div className="inline-flex flex-nowrap items-center gap-1.5">
          <Link
            className={buttonClass("ghost", "sm", "text-brand")}
            to="/client-portal/verifications"
            search={{ caseId: report.case.id }}
          >
            View case
          </Link>
          {report.latestVersion ? (
            <a
              className={buttonClass("secondary", "sm")}
              href={`/reports/verify/${encodeURIComponent(report.latestVersion.authenticityCode)}`}
              target="_blank"
              rel="noreferrer"
            >
              <BadgeCheck aria-hidden /> Verify
            </a>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            loading={download.isPending}
            disabled={stale || unavailable || download.isPending}
            onClick={() => download.mutate()}
            aria-label={`Download report for ${report.case.subject.fullName}`}
          >
            <Download aria-hidden /> {download.isPending ? "Preparing…" : "PDF"}
          </Button>
        </div>
      </Td>
    </tr>
  );
}
