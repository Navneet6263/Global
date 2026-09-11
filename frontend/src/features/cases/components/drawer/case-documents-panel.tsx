import { FileCheck2 } from "lucide-react";
import type { CaseDocument, VerificationCase } from "@/lib/contracts/case";
import type { StatusTone } from "@/lib/contracts/common";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatRelativeToNow } from "@/lib/formatting";
import { DocumentFileActions } from "@/features/cases/document-file-actions";

const DOC_TONE: Record<CaseDocument["status"], StatusTone> = {
  pending: "warning",
  received: "info",
  rejected: "critical",
  verified: "success",
};

const DOC_LABEL: Record<CaseDocument["status"], string> = {
  pending: "Pending",
  received: "Received",
  rejected: "Rejected",
  verified: "Verified",
};

export function CaseDocumentsPanel({ item }: { item: VerificationCase }) {
  if (item.documents.length === 0) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="No documents uploaded yet"
        description="Open the full case workspace to review the required evidence and candidate upload link."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {item.documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">{doc.label}</p>
            <p className="text-[11px] text-muted-foreground">
              Updated {formatRelativeToNow(doc.updatedAt)}
            </p>
            {doc.rejectionReason ? (
              <p className="mt-1 text-[11px] text-critical-foreground">{doc.rejectionReason}</p>
            ) : null}
          </div>
          <StatusBadge label={DOC_LABEL[doc.status]} tone={DOC_TONE[doc.status]} />
          {doc.available ? (
            <DocumentFileActions
              documentId={doc.id}
              filename={doc.originalName ?? `${doc.label}.pdf`}
              label={doc.label}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
