import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import type { MethodRun, MethodEvidenceDocument } from "@/lib/backend-api/verification-methods";
import { MethodResponseForm } from "./MethodResponseForm";
import { SourceOutreachPanel } from "./SourceOutreachPanel";

export function MethodHistory({
  checkId,
  items,
  documents,
  locked,
  onSaved,
}: {
  checkId: string;
  items: MethodRun[];
  documents: MethodEvidenceDocument[];
  locked: boolean;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [contacts, setContacts] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / 6));
  const visiblePage = Math.min(page, pageCount - 1);
  return (
    <div className="space-y-3">
      {items.slice(visiblePage * 6, visiblePage * 6 + 6).map((run) => (
        <article key={run.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">
              {humanize(run.method)} · {run.provider ?? "Internal review"}
            </h4>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] ${run.status === "SUPERSEDED" ? "bg-muted text-muted-foreground" : run.result === "DISCREPANCY" ? "bg-rose-50 text-rose-700" : run.result === "CLEAR" ? "bg-mint-soft text-mint-deep" : "bg-amber-50 text-amber-800"}`}
            >
              {humanize(run.status === "SUPERSEDED" ? run.status : (run.result ?? run.status))}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Requested {formatDateTime(run.requestedAt)}
            {run.respondedAt ? ` · Responded ${formatDateTime(run.respondedAt)}` : ""}
            {run.dueAt ? ` · Due ${formatDateTime(run.dueAt)}` : ""}
          </p>
          {run.sourceContact && (
            <p className="mt-1 text-xs text-muted-foreground">
              Source contact: {run.sourceContact}
            </p>
          )}
          {run.reference && <p className="mt-1 text-xs">Reference: {run.reference}</p>}
          {run.summary && (
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{run.summary}</p>
          )}
          {!!run.evidenceIds.length && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {run.evidenceIds.length} supporting document(s) linked
            </p>
          )}
          {run.nextFollowUpAt && run.status === "REQUESTED" && (
            <p className="mt-2 text-xs text-blue-700">
              Next contact: {formatDateTime(run.nextFollowUpAt)}
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            aria-expanded={contacts === run.id}
            onClick={() => setContacts(contacts === run.id ? null : run.id)}
          >
            Contact tracker
          </Button>
          {contacts === run.id && (
            <SourceOutreachPanel checkId={checkId} run={run} locked={locked} onSaved={onSaved} />
          )}
          {!locked && run.status === "REQUESTED" && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSelected(selected === run.id ? null : run.id)}
            >
              Record response
            </Button>
          )}
          {selected === run.id && !locked && run.status === "REQUESTED" && (
            <MethodResponseForm
              checkId={checkId}
              run={run}
              documents={documents}
              onSaved={() => {
                setSelected(null);
                onSaved();
              }}
            />
          )}
        </article>
      ))}
      {items.length > 6 && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            disabled={visiblePage === 0}
            onClick={() => setPage(visiblePage - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {visiblePage + 1} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={visiblePage + 1 >= pageCount}
            onClick={() => setPage(visiblePage + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
