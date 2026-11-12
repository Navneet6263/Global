import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Loader2, Send, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { submitCandidateL2Clarification, validateCandidateL2File } from "@/lib/api/clarifications";
import type { CandidateCase } from "@/lib/api/candidate-portal";
import { documentTypes } from "@/lib/backend-api/documents";
import { CandidateStatus } from "./candidate-ui";
import { docMeta, formatDate, l2StageNote } from "./candidate-utils";
import { CandidateL2Messages } from "./CandidateL2Messages";

type PortalClarification = CandidateCase["clarifications"][number];

export function CandidateL2ClarificationCard({
  accessId,
  token,
  item,
  noticeVersion,
  acknowledged = true,
  onSubmitted,
}: {
  accessId: string;
  token: string;
  item: PortalClarification;
  noticeVersion?: string;
  acknowledged?: boolean;
  onSubmitted?: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fixedDocType = item.requestedDocumentType || undefined;
  const [selectedDocType, setSelectedDocType] = useState(
    fixedDocType ?? item.submittedDocument?.type ?? "OTHER",
  );
  const [file, setFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState("");
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
  const [progress, setProgress] = useState(0);
  const [receipt, setReceipt] = useState<{ version: number; filename: string } | null>(null);

  const effectiveDocType = fixedDocType ?? selectedDocType;
  const meta = docMeta(effectiveDocType);

  const submit = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Please select a corrected PDF, JPEG or PNG document.");
      return submitCandidateL2Clarification({
        accessId,
        token,
        clarificationId: item.id,
        file,
        message: message.trim(),
        documentType: effectiveDocType,
        expiry: expiry || undefined,
        noticeVersion,
        onProgress: setProgress,
      });
    },
    onSuccess: async (result) => {
      setReceipt({
        version: result.submittedDocumentVersion,
        filename: file?.name ?? "Uploaded document",
      });
      setFile(null);
      setMessage("");
      setFileError("");
      toast.success("Corrected document submitted", {
        description: `Version v${result.submittedDocumentVersion} sent for review.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
      await onSubmitted?.();
    },
    onError: () => setProgress(0),
  });

  const stageNote = l2StageNote(item.status);
  const needsReupload = (item.rejectionCount ?? 0) > 0 && item.status === "OPEN";

  return (
    <article className="rounded-[1.15rem] border border-amber-200 bg-amber-50/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-slate-900">{item.subject}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
              Document re-upload
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            Required document: <strong>{meta.label}</strong>
            {item.dueAt ? ` · Reply by ${formatDate(item.dueAt)}` : ""}
          </p>
        </div>
        <CandidateStatus value={item.status} />
      </div>

      <CandidateL2Messages
        messages={item.messages}
        rejectionCount={item.rejectionCount}
        lastRejectedReason={item.lastRejectedReason}
        status={item.status}
      />

      {item.status === "OPEN" ? (
        <div className="mt-3.5 space-y-3 rounded-xl border border-amber-200/80 bg-white/95 p-3.5">
          {!fixedDocType ? (
            <label className="block text-[11.5px] font-medium text-slate-700">
              Document type
              <select
                value={selectedDocType}
                onChange={(event) => setSelectedDocType(event.target.value)}
                disabled={submit.isPending}
                className="mt-1 block h-9 w-full rounded-lg border border-input bg-white px-2.5 text-xs outline-none"
              >
                {documentTypes.map((docType) => (
                  <option key={docType} value={docType}>
                    {docMeta(docType).label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="application/pdf,image/jpeg,image/png"
              aria-label={`Select corrected ${meta.label}`}
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (!picked) return;
                const problem = validateCandidateL2File(picked);
                if (problem) {
                  setFileError(problem);
                  setFile(null);
                  return;
                }
                setFileError("");
                setFile(picked);
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!acknowledged || submit.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 text-[11.5px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Upload className="size-3.5" aria-hidden />
                {file ? "Change file" : `Choose ${meta.label} (PDF/JPG/PNG)`}
              </button>
              {file ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-800">
                  <FileUp className="size-3.5" aria-hidden />
                  <span className="max-w-[200px] truncate">{file.name}</span>
                  <span>({(file.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    aria-label="Remove selected file"
                    disabled={submit.isPending}
                    onClick={() => setFile(null)}
                    className="ml-0.5 text-emerald-700 hover:text-emerald-950"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : null}
            </div>
            {meta.expiry ? (
              <label className="mt-2 block text-[11.5px] text-slate-600">
                Document expiry (optional){" "}
                <input
                  type="date"
                  value={expiry}
                  disabled={submit.isPending}
                  onChange={(event) => setExpiry(event.target.value)}
                  className="ml-1 rounded-md border border-input px-2 py-1 text-xs"
                />
              </label>
            ) : null}
            {fileError ? (
              <p className="mt-1.5 text-[11px] font-medium text-destructive">{fileError}</p>
            ) : null}
          </div>

          <div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              rows={3}
              disabled={submit.isPending}
              placeholder="Explain what was corrected or updated in this upload (minimum 3 characters)…"
              aria-label="Clarification explanation"
              className="w-full resize-none rounded-[0.9rem] border border-input bg-white px-3 py-2 text-xs leading-5 outline-none focus:ring-2 focus:ring-primary/15"
            />
            <p className="mt-1 text-right text-[10.5px] text-slate-500">
              {message.trim().length}/5000 characters
            </p>
          </div>

          {submit.isPending ? (
            <div className="space-y-1">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-slate-100"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-150"
                  style={{ width: `${Math.max(progress, 8)}%` }}
                />
              </div>
              <p className="text-[11px] font-medium text-slate-600">
                Uploading corrected document… {progress}%
              </p>
            </div>
          ) : null}

          {submit.isError ? (
            <p role="alert" className="text-[11px] font-medium text-destructive">
              {submit.error.message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => submit.mutate()}
            disabled={!acknowledged || !file || message.trim().length < 3 || submit.isPending}
            aria-busy={submit.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-[11.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {needsReupload ? "Re-upload corrected document" : "Submit document & explanation"}
          </button>
        </div>
      ) : (
        <div
          role="status"
          className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11.5px] text-emerald-950"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          <div>
            <p className="font-semibold">
              {receipt
                ? `Uploaded ${receipt.filename} (v${receipt.version})`
                : item.submittedDocumentVersion
                  ? `${docMeta(item.submittedDocument?.type ?? effectiveDocType).label} v${item.submittedDocumentVersion} submitted`
                  : "Document submitted"}
            </p>
            {stageNote ? <p className="mt-0.5 text-emerald-900">{stageNote}</p> : null}
          </div>
        </div>
      )}
    </article>
  );
}
