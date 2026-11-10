import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveBlob } from "@/lib/backend-api/client";
import { openDocumentPreview } from "@/lib/backend-api/document-preview";
import { reportPreviewApi, type ReportAudience } from "@/lib/backend-api/report-preview";
import { cn } from "@/lib/utils";
import { ReportHeaderDetails } from "./ReportHeaderDetails";

export { ReportHeaderDetails } from "./ReportHeaderDetails";

const AUDIENCE: Record<ReportAudience, { label: string; hint: string }> = {
  client: {
    label: "Client copy",
    hint: "Exactly what the client will receive. It stays marked Draft until the final approval.",
  },
  internal: {
    label: "Internal copy",
    hint: "Adds who verified each check, the team, sources and costs. Never sent to the client.",
  },
};

/**
 * Opens the live report for a case: the client copy (what the client will receive) or
 * the internal working copy. Built by the same code as the approved report.
 */
export function ReportPreviewButton({
  caseId,
  caseNumber,
  candidateName,
  audiences,
  label = "Report preview",
  variant = "outline",
  className,
}: {
  caseId: string;
  caseNumber: string;
  candidateName: string;
  audiences: readonly ReportAudience[];
  label?: string;
  variant?: "outline" | "default" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileText aria-hidden /> {label}
      </Button>
      {open ? (
        <ReportPreviewDialog
          caseId={caseId}
          caseNumber={caseNumber}
          candidateName={candidateName}
          audiences={audiences}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function ReportPreviewDialog({
  caseId,
  caseNumber,
  candidateName,
  audiences,
  onClose,
}: {
  caseId: string;
  caseNumber: string;
  candidateName: string;
  audiences: readonly ReportAudience[];
  onClose: () => void;
}) {
  const [audience, setAudience] = useState<ReportAudience>(audiences[0] ?? "client");
  const pdf = useQuery({
    queryKey: ["report-preview", caseId, audience],
    queryFn: () => reportPreviewApi.pdf(caseId, audience),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pdf.data) {
      setBlobUrl(null);
      return;
    }
    const pdfBlob =
      pdf.data.type === "application/pdf"
        ? pdf.data
        : new Blob([pdf.data], { type: "application/pdf" });
    const next = URL.createObjectURL(pdfBlob);
    setBlobUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [pdf.data]);

  const fileName = `Sapling-Global-${audience === "internal" ? "internal-" : ""}draft-${caseNumber}.pdf`;

  const download = () => {
    if (!pdf.data) return;
    saveBlob(
      pdf.data.type === "application/pdf"
        ? pdf.data
        : new Blob([pdf.data], { type: "application/pdf" }),
      fileName,
    );
  };

  const openNewTab = () => {
    void openDocumentPreview(async () => {
      if (pdf.data) {
        return pdf.data.type === "application/pdf"
          ? pdf.data
          : new Blob([pdf.data], { type: "application/pdf" });
      }
      return reportPreviewApi.pdf(caseId, audience);
    }).catch((err: Error) => {
      toast.error("Could not open preview", { description: err.message });
    });
  };

  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
        <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-slate-100 px-5 py-4 pr-12">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2">
              Report preview
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold text-amber-700 ring-1 ring-amber-200">
                Draft
              </span>
            </DialogTitle>
            <DialogDescription className="truncate">
              {candidateName} · {caseNumber}
            </DialogDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {audiences.length > 1 ? (
              <div
                role="radiogroup"
                aria-label="Report copy"
                className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
              >
                {audiences.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={audience === value}
                    onClick={() => setAudience(value)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-[12.5px] font-semibold",
                      audience === value
                        ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {AUDIENCE[value].label}
                  </button>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pdf.data}
              onClick={openNewTab}
            >
              <ExternalLink aria-hidden /> New tab
            </Button>
            <Button type="button" size="sm" disabled={!pdf.data} onClick={download}>
              <Download aria-hidden /> Download
            </Button>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] lg:grid-cols-[280px_1fr] lg:grid-rows-1">
          <aside className="grid content-start gap-3 overflow-y-auto border-b border-slate-100 bg-white p-4 lg:border-b-0 lg:border-r">
            <p className="rounded-xl bg-slate-50 p-3 text-[12.5px] leading-relaxed text-slate-600">
              <strong className="block text-slate-900">{AUDIENCE[audience].label}</strong>
              {AUDIENCE[audience].hint}
            </p>
            <ReportHeaderDetails caseId={caseId} />
          </aside>
          <section aria-label="Report" className="relative min-h-[320px] bg-slate-100">
            {pdf.isError ? (
              <div className="grid h-full place-items-center p-6 text-center">
                <div className="grid max-w-sm justify-items-center gap-3">
                  <p role="alert" className="text-[13px] text-red-600">
                    {pdf.error.message}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => void pdf.refetch()}>
                    <RefreshCw aria-hidden /> Try again
                  </Button>
                </div>
              </div>
            ) : pdf.isFetching && !blobUrl ? (
              <div className="grid h-full place-items-center text-[13px] text-slate-500">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Building the report…
                </span>
              </div>
            ) : blobUrl ? (
              <div className="relative h-full w-full">
                {pdf.isFetching && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-xs">
                    <span className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 shadow-md ring-1 ring-slate-200">
                      <Loader2 className="size-4 animate-spin text-blue-600" aria-hidden /> Updating
                      preview…
                    </span>
                  </div>
                )}
                <iframe
                  key={blobUrl}
                  src={blobUrl}
                  title={`${AUDIENCE[audience].label} of the report`}
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-slate-500">
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Building the report…
                </span>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
