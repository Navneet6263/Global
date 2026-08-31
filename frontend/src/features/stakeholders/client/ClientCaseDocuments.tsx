import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { CaseDetail } from "@/lib/api/cases";
import { uploadDocument } from "@/lib/api/documents";
import { humanize, statusTone } from "./client-portal-utils";

type CaseDocument = CaseDetail["documents"][number];

const uploadableStatuses = new Set([
  "DRAFT",
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
]);

export function ClientCaseDocuments({
  caseId,
  caseStatus,
  items,
}: {
  caseId: string;
  caseStatus: string;
  items: CaseDocument[];
}) {
  const canUpload = uploadableStatuses.has(caseStatus);
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground">Documents</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Secure versions, current review state and re-upload controls
        </p>
      </header>
      <div className="space-y-2 p-3">
        {items.map((document) => (
          <DocumentRow
            key={document.publicId}
            caseId={caseId}
            item={document}
            canUpload={canUpload}
          />
        ))}
        {!items.length ? (
          <div className="flex flex-col items-center py-7 text-center">
            <FileUp className="size-5 text-muted-foreground/45" />
            <p className="mt-2 text-xs text-muted-foreground">
              No document has been requested yet.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DocumentRow({
  caseId,
  item,
  canUpload,
}: {
  caseId: string;
  item: CaseDocument;
  canUpload: boolean;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File>();
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a document first");
      return uploadDocument(item.publicId, file);
    },
    onSuccess: () => {
      toast.success("Document uploaded securely");
      setFile(undefined);
      void queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const latest = item.versions.at(-1);
  return (
    <article className="rounded-2xl border border-border bg-card/70 p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-deep shadow-[var(--shadow-card)]">
            {item.currentVersion ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{humanize(item.type)}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {latest
                ? `${latest.originalName} · version ${item.currentVersion}`
                : "Upload is still pending"}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusTone(item.status)}`}
        >
          {humanize(item.status)}
        </span>
      </div>
      {canUpload ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border-strong bg-card px-3 py-2 text-[10px] text-muted-foreground hover:border-primary/45 hover:text-foreground">
            <UploadCloud className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {file?.name ?? (item.currentVersion ? "Choose replacement file" : "Choose document")}
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-[10px] font-semibold text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-35"
          >
            {upload.isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="h-3.5 w-3.5" />
            )}
            {item.currentVersion ? "Upload new version" : "Upload"}
          </button>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-[10px] text-muted-foreground">
          Uploads are locked after verification enters review or completion.
        </p>
      )}
    </article>
  );
}
