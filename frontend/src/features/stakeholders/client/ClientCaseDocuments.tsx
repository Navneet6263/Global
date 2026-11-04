import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { CaseDetail } from "@/lib/api/cases";
import { createDocument, uploadDocument, type DocumentType } from "@/lib/api/documents";
import { humanize, statusTone } from "./client-portal-utils";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { caseDate } from "./client-case-activity";

const fileSize = (bytes: string | number) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "size unknown";
  return size >= 1_048_576
    ? `${(size / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(size / 1024))} KB`;
};

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
  requirements = [],
}: {
  caseId: string;
  caseStatus: string;
  items: CaseDocument[];
  /** Every document this case asks for, and the checks it is for. */
  requirements?: ReadonlyArray<{ type: string; checks: string[] }>;
}) {
  const canUpload = uploadableStatuses.has(caseStatus);
  const forChecks = (type: string) => requirements.find((item) => item.type === type)?.checks ?? [];
  const missing = requirements.filter((item) => !items.some((doc) => doc.type === item.type));
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground">Documents</h3>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          What the candidate uploaded, its review status, and what is still missing
        </p>
      </header>
      <div className="space-y-2 p-3">
        {items.map((document) => (
          <DocumentRow
            key={document.publicId}
            caseId={caseId}
            item={document}
            canUpload={canUpload}
            checks={forChecks(document.type)}
          />
        ))}
        {missing.map((item) => (
          <MissingDocumentRow
            key={item.type}
            caseId={caseId}
            type={item.type}
            checks={item.checks}
            canUpload={canUpload}
          />
        ))}
        {!items.length && !missing.length ? (
          <div className="flex flex-col items-center py-7 text-center">
            <FileUp className="size-5 text-muted-foreground/45" />
            <p className="mt-2 text-xs text-muted-foreground">
              No documents are available for this case yet.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ForChecks({ checks }: { checks: readonly string[] }) {
  if (!checks.length) return null;
  return (
    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
      For: {checks.map(humanize).join(", ")}
    </p>
  );
}

/** A required document nobody has uploaded yet; the client may upload it for the candidate. */
function MissingDocumentRow({
  caseId,
  type,
  checks,
  canUpload,
}: {
  caseId: string;
  type: string;
  checks: readonly string[];
  canUpload: boolean;
}) {
  const queryClient = useQueryClient();
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const created = await createDocument(caseId, type as DocumentType);
      return uploadDocument(created.id, file);
    },
    onSuccess: () => {
      toast.success("Document uploaded securely");
      void queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
          <FileUp className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{humanize(type)}</p>
          <ForChecks checks={checks} />
          <p className="mt-0.5 text-[10px] text-muted-foreground">Not uploaded yet</p>
        </div>
      </div>
      {canUpload ? (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-slate-50">
          {upload.isPending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <UploadCloud className="size-3.5" aria-hidden />
          )}
          Upload {humanize(type)}
          <input
            type="file"
            className="sr-only"
            aria-label={`Upload ${humanize(type)}`}
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate(file);
            }}
          />
        </label>
      ) : null}
    </article>
  );
}

function DocumentRow({
  caseId,
  item,
  canUpload,
  checks,
}: {
  caseId: string;
  item: CaseDocument;
  canUpload: boolean;
  checks: readonly string[];
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
  const latest = item.versions[0];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
            {item.currentVersion ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{humanize(item.type)}</p>
            <ForChecks checks={checks} />
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {latest
                ? `${latest.originalName} · ${fileSize(latest.sizeBytes)} · uploaded ${caseDate(latest.createdAt)}`
                : item.currentVersion > 0
                  ? "Uploaded · being scanned before it can be opened"
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
      {latest ? (
        <div className="mt-3 flex justify-end">
          <DocumentFileActions
            documentId={item.publicId}
            filename={latest.originalName}
            label={humanize(item.type)}
            compact={false}
          />
        </div>
      ) : null}
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
            aria-busy={upload.isPending}
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
