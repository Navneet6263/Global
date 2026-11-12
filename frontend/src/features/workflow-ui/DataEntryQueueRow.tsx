import { FileText, ListChecks, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnifiedQueueCase } from "@/lib/backend-api/data-entry-queue";
import { dueLabel, readableCheck, sinceLabel } from "./flow-model";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export function DataEntryQueueRow({
  item,
  view,
  focused,
  onOpen,
  onReassign,
}: {
  item: UnifiedQueueCase;
  view: "mine" | "team";
  focused: boolean;
  onOpen: (item: UnifiedQueueCase) => void;
  onReassign: (item: UnifiedQueueCase) => void;
}) {
  const l2List = item.l2Reentries ?? [];
  const hasL2 = l2List.length > 0;
  const hasNormalIntake = ["DATA_ENTRY", "CORRECTION"].includes(item.intakeStage ?? "");
  const correction = item.intakeStage === "CORRECTION";
  const canReassign = view === "team" && hasNormalIntake && item.status === "DOCUMENT_PENDING";
  const due = dueLabel(item.dueAt ?? l2List[0]?.dueAt ?? null);
  const l2Rejections = l2List.reduce((sum, row) => sum + (row.rejectionCount || 0), 0);
  const firstL2 = l2List[0];
  const sinceText =
    !hasNormalIntake && firstL2?.opsReviewedAt
      ? `Ops ${sinceLabel(firstL2.opsReviewedAt) || "—"}`
      : `since ${sinceLabel(item.dataEntryAssignedAt) || "—"}`;

  return (
    <li className={`dei-row ${focused ? "is-focused" : ""} ${correction ? "is-correction" : ""}`}>
      <button
        type="button"
        className="dei-row-main"
        aria-pressed={focused}
        onClick={() => onOpen(item)}
        aria-label={`Review ${item.candidateName}`}
      >
        <span className="dei-avatar" aria-hidden>
          {initials(item.candidateName)}
        </span>
        <span className="min-w-0">
          <strong>{item.candidateName}</strong>
          <small>
            {item.client.name} · {item.caseNumber}
          </small>
        </span>
      </button>
      <span className="dei-row-tags">
        {hasL2 ? (
          <>
            <span className="rmo-pill !bg-indigo-50 !text-indigo-700">L2 Re-entry</span>
            <span className="dei-tag">
              <RotateCcw aria-hidden />
              {l2List.length === 1
                ? `${firstL2?.checkType ? readableCheck(firstL2.checkType) : "Clarification"} · v${firstL2?.submittedDocumentVersion ?? "?"}`
                : `${l2List.length} L2 checks`}
            </span>
            {l2Rejections > 0 ? (
              <span className="rmo-pill is-bad">{l2Rejections} rejected</span>
            ) : null}
          </>
        ) : null}
        {hasNormalIntake ? (
          <>
            <span className={`rmo-pill ${correction ? "is-warn" : "is-info"}`}>
              {correction ? "Waiting on correction" : "To review"}
            </span>
            <span className="dei-tag">
              <FileText aria-hidden /> {item.documents.total} doc
              {item.documents.total === 1 ? "" : "s"}
            </span>
            <span className="dei-tag">
              <ListChecks aria-hidden /> {item.checks.total} check
              {item.checks.total === 1 ? "" : "s"}
            </span>
            {item.documents.rejected ? (
              <span className="rmo-pill is-bad">{item.documents.rejected} rejected</span>
            ) : null}
          </>
        ) : null}
      </span>
      <span className="dei-row-who">
        <span>
          {view === "team" ? (item.dataEntry?.name ?? "—") : `RM ${item.rm?.name ?? "—"}`}
        </span>
        <small>{sinceText}</small>
      </span>
      <span className={`rmo-pill is-${due.tone} dei-due`}>{due.text}</span>
      <span className="dei-row-actions">
        <Button size="sm" variant={focused ? "default" : "outline"} onClick={() => onOpen(item)}>
          Review
        </Button>
        {canReassign ? (
          <Button size="sm" variant="outline" onClick={() => onReassign(item)}>
            Reassign
          </Button>
        ) : null}
      </span>
    </li>
  );
}
