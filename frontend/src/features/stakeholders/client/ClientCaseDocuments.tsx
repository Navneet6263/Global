import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, LoaderCircle, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { CaseDetail } from "@/lib/api/cases";
import { createDocument, uploadDocument, type DocumentType } from "@/lib/api/documents";
import { Button, Card, CardHeader, Chip } from "@/kit";
import { humanize, statusKind } from "./client-portal-utils";
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
    <Card>
      <CardHeader
        title="Documents"
        description="What the candidate uploaded, its review status, and what is still missing"
      />
      <div className="flex flex-col gap-2 p-3">
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
            <FileUp className="size-5 text-dim/50" aria-hidden />
            <p className="mt-2 text-sm text-dim">No documents are available for this case yet.</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function ForChecks({ checks }: { checks: readonly string[] }) {
  if (!checks.length) return null;
  return <p className="truncate text-xs text-dim">For: {checks.map(humanize).join(", ")}</p>;
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
    <article className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line bg-surface p-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-subtle text-dim">
          <FileUp className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{humanize(type)}</p>
          <ForChecks checks={checks} />
          <p className="text-xs text-warn">Not uploaded yet</p>
        </div>
      </div>
      {canUpload ? (
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-subtle">
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
    <article className="rounded-lg border border-line bg-surface shadow-soft p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
            {item.currentVersion ? (
              <CheckCircle2 className="size-4 text-good" aria-hidden />
            ) : (
              <FileUp className="size-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{humanize(item.type)}</p>
            <ForChecks checks={checks} />
            <p className="truncate text-xs text-dim">
              {latest
                ? `${latest.originalName} · ${fileSize(latest.sizeBytes)} · uploaded ${caseDate(latest.createdAt)}`
                : item.currentVersion > 0
                  ? "Uploaded · being scanned before it can be opened"
                  : "Upload is still pending"}
            </p>
          </div>
        </div>
        <Chip tone={statusKind(item.status)}>{humanize(item.status)}</Chip>
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
          <label className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-line bg-subtle/40 px-3 text-xs text-dim hover:border-brand/50 hover:text-ink">
            <UploadCloud className="size-4 shrink-0" aria-hidden />
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
          <Button
            variant="primary"
            onClick={() => upload.mutate()}
            disabled={!file}
            loading={upload.isPending}
          >
            <UploadCloud aria-hidden />
            {item.currentVersion ? "Upload new version" : "Upload"}
          </Button>
        </div>
      ) : (
        <p className="mt-3 rounded-md bg-subtle px-3 py-2 text-xs text-dim">
          Uploads are locked after verification enters review or completion.
        </p>
      )}
    </article>
  );
}
