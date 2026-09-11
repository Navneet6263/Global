"use client";

import { FileText } from "lucide-react";
import type { OpsCaseDetail } from "../contracts/case";
import { OPS_DOCUMENT_STATUS_META } from "../contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { formatRelativeToNow } from "@/lib/formatting";
import { DocumentReviewControls } from "@/features/cases/document-review-controls";

export function OpsCaseDocuments({ documents }: { documents: OpsCaseDetail["documents"] }) {
  if (!documents.length) {
    return <p className="pt-4 text-xs text-muted-foreground">No documents uploaded yet.</p>;
  }

  return (
    <ul className="space-y-2 pt-4">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3 py-2.5"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{document.label}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {document.originalName ?? "Awaiting upload"} ·{" "}
              {formatRelativeToNow(document.updatedAt)}
              {document.note ? ` · ${document.note}` : ""}
            </p>
          </div>
          <StatusBadge
            label={OPS_DOCUMENT_STATUS_META[document.status].label}
            tone={OPS_DOCUMENT_STATUS_META[document.status].tone}
          />
          {document.available ? (
            <DocumentFileActions
              documentId={document.id}
              filename={document.originalName ?? `${document.label}.pdf`}
              label={document.label}
            />
          ) : null}
          {document.available ? (
            <DocumentReviewControls
              document={{
                id: document.id,
                revision: document.revision,
                fileVersion: document.version,
                expiresAt: document.expiresAt,
              }}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
