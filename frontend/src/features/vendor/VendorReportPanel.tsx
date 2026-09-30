import { useState } from "react";
import { Download, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBytes } from "@/features/cases/case-detail-formatting";
import { formatDateTime } from "@/lib/formatting";
import { useUploadReport } from "./use-vendor-requests";
import { vendorApi } from "./vendor-api";
import type { VendorRequestDetail } from "./vendor-contracts";
import { REPORT_ACCEPT, reportDownloadName, reportFileProblem } from "./vendor-report-model";

/**
 * The report of an APPROVED request: upload it, replace it with a new version, or open
 * the latest one. SPOC-RM is notified on every upload; the server re-checks every rule.
 */
export function VendorReportPanel({ item }: { item: VendorRequestDetail }) {
  const upload = useUploadReport();
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [opening, setOpening] = useState<"preview" | "download" | null>(null);
  const report = item.report;

  const open = async (mode: "preview" | "download") => {
    if (!report) return;
    setOpening(mode);
    try {
      if (mode === "preview") await vendorApi.previewReport(item.id);
      else
        await vendorApi.downloadReport(
          item.id,
          reportDownloadName(item.caseNumber, report.version, report.contentType),
        );
    } catch (error) {
      toast.error(mode === "preview" ? "Preview failed" : "Download failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setOpening(null);
    }
  };

  const submit = () => {
    if (!file) return;
    upload.mutate(
      { requestId: item.id, file },
      {
        onSuccess: () => {
          setFile(null);
          setInputKey((key) => key + 1);
        },
      },
    );
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border p-3">
      <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Report
      </p>
      {report ? (
        <div className="space-y-2">
          <p className="font-medium break-words text-foreground">{report.name}</p>
          <p className="text-[11px] text-muted-foreground">
            v{report.version} · {formatBytes(String(report.sizeBytes))} · {report.uploadedBy} ·{" "}
            {formatDateTime(report.uploadedAt)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={opening !== null}
              loading={opening === "preview"}
              onClick={() => void open("preview")}
            >
              <Eye className="size-3.5" aria-hidden /> Preview report
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={opening !== null}
              loading={opening === "download"}
              onClick={() => void open("download")}
            >
              <Download className="size-3.5" aria-hidden /> Download report
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No report yet. SPOC-RM sees it once you upload it.</p>
      )}
      {item.canUploadReport ? (
        <form
          className="space-y-2 border-t border-border/70 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            key={inputKey}
            type="file"
            accept={REPORT_ACCEPT}
            aria-label={report ? "Replacement report file" : "Report file"}
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null;
              const problem = chosen ? reportFileProblem(chosen) : null;
              if (problem) {
                toast.error("Choose another file", { description: problem });
                event.target.value = "";
              }
              setFile(problem ? null : chosen);
            }}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!file || upload.isPending}
            loading={upload.isPending}
          >
            <Upload className="size-3.5" aria-hidden />
            {report ? "Replace report" : "Upload report"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            PDF or PNG · 2 MB maximum · a replacement becomes a new version.
          </p>
        </form>
      ) : null}
    </section>
  );
}
