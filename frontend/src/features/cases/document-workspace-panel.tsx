import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Empty, Panel, Status } from "./case-detail-ui";
import { formatBytes, humanize } from "./case-detail-formatting";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import {
  createDocument,
  documentTypes,
  uploadDocument,
  getEvidenceReadiness,
  type DocumentType,
} from "@/lib/api/documents";
import { DocumentReviewControls } from "./document-review-controls";
import { DocumentFileActions } from "./document-file-actions";

export function DocumentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("AADHAAR");
  const [file, setFile] = useState<File | null>(null);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canWrite =
    (session.data?.permissions.includes("*") ||
      session.data?.permissions.includes("document:write")) &&
    [
      "DRAFT",
      "CONSENT_PENDING",
      "DOCUMENT_PENDING",
      "IN_PROGRESS",
      "CLARIFICATION_PENDING",
    ].includes(item.status);
  const canRead =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("document:read");
  const canReview =
    session.data?.roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER", "QA_REVIEWER"].includes(role),
    ) &&
    ![
      "MANAGER_REVIEW",
      "REPORT_PENDING",
      "PAYMENT_PENDING",
      "COMPLETED",
      "CLOSED",
      "CANCELLED",
    ].includes(item.status);
  const readiness = useQuery({
    queryKey: ["evidence-readiness", item.id],
    queryFn: () => getEvidenceReadiness(item.id),
  });
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file to upload");
      const document = await createDocument(item.id, type);
      return uploadDocument(document.id, file);
    },
    onSuccess: () => {
      toast.success("Document uploaded and integrity hash recorded");
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["case", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["evidence-readiness", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel title="Documents" subtitle="Versioned evidence with integrity and safety checks">
      <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-blue-800">
          OCR & automatic identity matching · Coming soon.
        </span>{" "}
        Upload checks and human document review work now; automatic name, DOB and document-number
        matching needs a connected provider.
      </p>
      {readiness.data ? (
        <div
          className={`mb-4 rounded-2xl p-3 text-xs ${readiness.data.ready ? "bg-success-soft text-success-foreground" : "bg-warning-soft text-warning-foreground"}`}
        >
          <p className="font-semibold">
            {readiness.data.ready ? "Evidence requirements satisfied" : "Evidence needs attention"}
          </p>
          {readiness.data.issues.map((issue) => (
            <p key={issue} className="mt-1">
              {issue.replaceAll("_", " ")}
            </p>
          ))}
        </div>
      ) : null}
      {canWrite ? (
        <div className="mb-4 grid gap-2 rounded-2xl border border-dashed border-border bg-secondary/25 p-3 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(12rem,1fr)_auto]">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
            aria-label="Document type"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          >
            {documentTypes.map((documentType) => (
              <option key={documentType} value={documentType}>
                {humanize(documentType)}
              </option>
            ))}
          </select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-0 truncate">{file?.name ?? "Choose PDF or image"}</span>
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            aria-busy={upload.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {upload.isPending ? "Securing…" : "Add document"}
          </button>
        </div>
      ) : null}

      {item.documents.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {item.documents.map((document) => {
            const latest = document.versions[0];
            return (
              <div
                key={document.publicId}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{humanize(document.type)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {latest
                      ? `v${latest.version} · ${formatBytes(latest.sizeBytes)} · ${humanize(latest.malwareState)}`
                      : "Awaiting first version"}
                  </p>
                </div>
                <Status status={document.status} />
                {canRead && latest ? (
                  <DocumentFileActions
                    documentId={document.publicId}
                    filename={latest.originalName}
                    label={humanize(document.type)}
                  />
                ) : null}
                {document.reviewNote ? (
                  <p className="w-full text-xs text-muted-foreground">{document.reviewNote}</p>
                ) : null}
                {canReview && latest ? (
                  <DocumentReviewControls
                    document={{
                      id: document.publicId,
                      revision: document.version,
                      fileVersion: document.currentVersion,
                      expiresAt: document.expiresAt,
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty text="No documents requested or uploaded" />
      )}
    </Panel>
  );
}
