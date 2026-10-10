import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  reportPreviewApi,
  type ReportAudience,
  type ReportDetails,
} from "@/lib/backend-api/report-preview";
import { cn } from "@/lib/utils";

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
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!pdf.data) return;
    const next = URL.createObjectURL(pdf.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [pdf.data]);
  const fileName = `Sapling-Global-${audience === "internal" ? "internal-" : ""}draft-${caseNumber}.pdf`;
  const download = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
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
              disabled={!url}
              onClick={() => window.open(url, "_blank", "noopener")}
            >
              <ExternalLink aria-hidden /> New tab
            </Button>
            <Button type="button" size="sm" disabled={!url} onClick={download}>
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
            ) : url && !pdf.isFetching ? (
              <iframe
                key={url}
                src={url}
                title={`${AUDIENCE[audience].label} of the report`}
                className="absolute inset-0 h-full w-full border-0"
              />
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

/** Date of joining and client process for the report header. */
export function ReportHeaderDetails({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ["report-details", caseId],
    queryFn: () => reportPreviewApi.details(caseId),
  });
  if (details.isPending)
    return <p className="text-[12.5px] text-slate-500">Loading report details…</p>;
  if (details.isError) return <p className="text-[12.5px] text-red-600">{details.error.message}</p>;
  return (
    <HeaderForm
      key={`${details.data.joiningDate}-${details.data.clientProcess}`}
      caseId={caseId}
      data={details.data}
      onSaved={async () => {
        await queryClient.invalidateQueries({ queryKey: ["report-details", caseId] });
        await queryClient.invalidateQueries({ queryKey: ["report-preview", caseId] });
        await queryClient.invalidateQueries({ queryKey: ["report-view", caseId] });
      }}
    />
  );
}

function HeaderForm({
  caseId,
  data,
  onSaved,
}: {
  caseId: string;
  data: ReportDetails;
  onSaved: () => Promise<void>;
}) {
  const [joiningDate, setJoiningDate] = useState(data.joiningDate ?? "");
  const [clientProcess, setClientProcess] = useState(data.clientProcess ?? "");
  const changed =
    joiningDate !== (data.joiningDate ?? "") || clientProcess !== (data.clientProcess ?? "");
  const save = useMutation({
    mutationFn: () =>
      reportPreviewApi.saveDetails(caseId, {
        joiningDate: joiningDate || null,
        clientProcess: clientProcess.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Report details saved", { description: "The preview is updated." });
      await onSaved();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const input =
    "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <form
      aria-label="Report header details"
      className="grid gap-3 rounded-xl border border-slate-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">Report header</h3>
        <p className="text-[12px] text-slate-500">
          {data.canEdit
            ? "Printed on the executive summary."
            : "Only Operations, the case RM or its Data Entry can change these before approval."}
        </p>
      </div>
      <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
        Date of joining
        <input
          type="date"
          value={joiningDate}
          disabled={!data.canEdit}
          onChange={(event) => setJoiningDate(event.target.value)}
          className={input}
        />
      </label>
      <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
        Client process / reference
        <input
          value={clientProcess}
          maxLength={80}
          disabled={!data.canEdit}
          placeholder="e.g. ABC-1212"
          onChange={(event) => setClientProcess(event.target.value)}
          className={input}
        />
      </label>
      {data.canEdit ? (
        <Button type="submit" size="sm" disabled={!changed} loading={save.isPending}>
          Save and refresh preview
        </Button>
      ) : null}
    </form>
  );
}
