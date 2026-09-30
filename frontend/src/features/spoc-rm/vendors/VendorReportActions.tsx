import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reportDownloadName } from "@/features/vendor/vendor-report-model";
import { spocVendorApi } from "./spoc-vendor-api";
import type { VendorAttempt } from "./spoc-vendor-contracts";

/** Preview report / Download report for the latest APPROVED attempt that has a report. */
export function VendorReportActions({
  attempt,
  caseNumber,
}: {
  attempt: VendorAttempt | null;
  caseNumber: string;
}) {
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const report = attempt?.status === "APPROVED" ? attempt.report : null;
  if (!attempt || !report) return null;

  const open = async (mode: "preview" | "download") => {
    setBusy(mode);
    try {
      if (mode === "preview") await spocVendorApi.previewReport(attempt.id);
      else
        await spocVendorApi.downloadReport(
          attempt.id,
          reportDownloadName(caseNumber, report.version, report.contentType),
        );
    } catch (error) {
      toast.error(mode === "preview" ? "Preview failed" : "Download failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={busy !== null}
        loading={busy === "preview"}
        title={`Report v${report.version} from ${attempt.vendor.name}`}
        onClick={() => void open("preview")}
      >
        <FileText className="size-4" aria-hidden /> Preview report
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy !== null}
        loading={busy === "download"}
        onClick={() => void open("download")}
      >
        <Download className="size-4" aria-hidden /> Download report
      </Button>
    </>
  );
}
