"use client";

import { useMutation } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import type { OpsCaseDetail } from "../contracts/case";
import { OPS_DOCUMENT_STATUS_META } from "../contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { downloadDocument } from "@/lib/backend-api/documents";
import { formatRelativeToNow } from "@/lib/formatting";

export function OpsCaseDocuments({ documents }: { documents: OpsCaseDetail["documents"] }) {
  const download = useMutation({
    mutationFn: (document: OpsCaseDetail["documents"][number]) =>
      downloadDocument(document.id, document.originalName ?? `${document.label}.pdf`),
    onError: (error: Error) =>
      toast.error("Document could not be opened", {
        description: error.message,
      }),
  });

  if (!documents.length) {
    return <p className="pt-4 text-xs text-muted-foreground">No documents uploaded yet.</p>;
  }

  return (
    <ul className="space-y-2 pt-4">
      {documents.map((document) => (
        <li
          key={document.id}
          className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
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
            <Button
              variant="outline"
              size="icon"
              disabled={download.isPending}
              onClick={() => download.mutate(document)}
              aria-label={`Download ${document.label}`}
            >
              <Download className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
