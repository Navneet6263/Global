import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Download, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadReport, type PublishedReportSummary } from "@/lib/backend-api/reports";
import { formatDate } from "./client-portal-utils";
import { ClientPill } from "./ClientPageParts";

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
    <tr>
      <td>
        <div className="client-register-person">
          <span className="client-file-icon">
            <FileCheck2 aria-hidden />
          </span>
          <div>
            <strong>{report.case.subject.fullName}</strong>
            <small>{report.case.caseNumber}</small>
          </div>
        </div>
      </td>
      <td>
        {report.publishedAt ? formatDate(report.publishedAt) : "Not recorded"}
        <small>Version {report.latestVersion?.version ?? report.currentVersion}</small>
      </td>
      <td>
        <ClientPill tone={unavailable ? "amber" : "green"}>
          {unavailable ? "Access unavailable" : "Released"}
        </ClientPill>
        <small>
          {report.downloadExpiresAt
            ? `Access until ${formatDate(report.downloadExpiresAt)}`
            : "Authorised client access"}
        </small>
      </td>
      <td>
        <div className="client-row-actions">
          <Link
            className="client-text-link"
            to="/client-portal/verifications"
            search={{ caseId: report.case.id }}
          >
            View case
          </Link>
          {report.latestVersion && (
            <a
              className="client-outline-link"
              href={`/reports/verify/${encodeURIComponent(report.latestVersion.authenticityCode)}`}
              target="_blank"
              rel="noreferrer"
            >
              <BadgeCheck aria-hidden /> Verify
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            loading={download.isPending}
            disabled={stale || unavailable || download.isPending}
            onClick={() => download.mutate()}
            aria-label={`Download report for ${report.case.subject.fullName}`}
          >
            <Download aria-hidden /> {download.isPending ? "Preparing…" : "PDF"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
