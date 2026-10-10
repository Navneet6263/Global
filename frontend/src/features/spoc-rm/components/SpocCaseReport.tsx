import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileCheck2, FileClock, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadCaseReport, regenerateReport } from "@/lib/backend-api/reports";
import { cn } from "@/lib/utils";
import type { SpocCaseDetail } from "../contracts/spoc";
import { spocKeys } from "../hooks/use-spoc";
import { date, dateTime, label } from "../utils/spoc-format";

type Report = SpocCaseDetail["reports"][number];

/** The case's final report: status, download and (when its PDF needs rebuilding) regenerate. */
export function SpocCaseReport({ item }: { item: SpocCaseDetail }) {
  const report = item.reports[0];
  const [regenerating, setRegenerating] = useState(false);
  const download = useMutation({
    mutationFn: (target: Report) => downloadCaseReport(item.id, target.id, item.caseNumber),
    onError: (error: Error) => toast.error("Report not downloaded", { description: error.message }),
  });
  if (!report)
    return (
      <section
        aria-label="Final report"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500">
          <FileClock className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold text-slate-900">No report yet</p>
          <p className="text-[12.5px] text-slate-500">
            The report is generated when you give final approval after QC.
          </p>
        </div>
      </section>
    );
  const released = report.status === "PUBLISHED";
  return (
    <section
      aria-label="Final report"
      className={cn(
        "rounded-2xl border p-4",
        released ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl ring-1",
            released
              ? "bg-white text-emerald-600 ring-emerald-200"
              : "bg-slate-50 text-slate-500 ring-slate-200",
          )}
        >
          <FileCheck2 className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-slate-900">
            Final report · version {report.latest?.version ?? report.currentVersion}
          </p>
          <p className="text-[12.5px] text-slate-600">
            {released ? "Released to the client" : label(report.status)}
            {report.releasedAt ? ` on ${date(report.releasedAt)}` : ""}
            {report.latest ? ` · generated ${dateTime(report.latest.generatedAt)}` : ""}
            {report.latest ? ` · code ${report.latest.authenticityCode}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report.canDownload ? (
            <Button size="sm" loading={download.isPending} onClick={() => download.mutate(report)}>
              <Download aria-hidden /> Download PDF
            </Button>
          ) : null}
          {report.canRegenerate ? (
            <Button size="sm" variant="outline" onClick={() => setRegenerating(true)}>
              <RefreshCcw aria-hidden /> Regenerate PDF
            </Button>
          ) : null}
        </div>
      </div>
      {report.canRegenerate ? (
        <p className="mt-3 text-[12px] text-slate-500">
          If the PDF does not download (file missing) or should use the latest report layout,
          regenerate it. The approved findings stay the same; a new version with a new authenticity
          code is created and the old one stays on record.
        </p>
      ) : null}
      {regenerating ? (
        <RegenerateDialog caseId={item.id} report={report} onClose={() => setRegenerating(false)} />
      ) : null}
    </section>
  );
}

function RegenerateDialog({
  caseId,
  report,
  onClose,
}: {
  caseId: string;
  report: Report;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => regenerateReport(caseId, report.id, reason.trim()),
    onSuccess: async (result) => {
      toast.success(`Report regenerated · version ${result.version}`, {
        description: `New authenticity code ${result.authenticityCode}.`,
      });
      await queryClient.invalidateQueries({ queryKey: spocKeys.case(caseId) });
      onClose();
    },
    onError: (error: Error) =>
      toast.error("Report not regenerated", { description: error.message }),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Regenerate report PDF</DialogTitle>
          <DialogDescription>
            Builds version {(report.latest?.version ?? report.currentVersion) + 1} from the approved
            findings. The reason is saved in the audit trail.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
          Reason (at least 10 characters)
          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. The released PDF is missing from storage and the client cannot download it"
            className="rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 10}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            <RefreshCcw aria-hidden /> Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
