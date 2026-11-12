import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QueueCase } from "@/lib/backend-api/workflow";
import { canStop, dueLabel, flowPosition, sinceLabel } from "./flow-model";
import {
  canRaiseInsufficiency,
  initialsOf,
  isBulkDataEntryEligible,
  nextAction,
  type RmActionKind,
} from "./rm-queue-model";

type RmColKey = "stage" | "working" | "checks" | "documents" | "due" | "received";

export function RmQueueRow({
  item,
  show,
  focused,
  showSelect = false,
  selected = false,
  selectionLimitReached = false,
  onToggleSelect,
  onFocus,
  onAction,
}: {
  item: QueueCase;
  show: (key: RmColKey) => boolean;
  focused: boolean;
  showSelect?: boolean;
  selected?: boolean;
  selectionLimitReached?: boolean;
  onToggleSelect?: () => void;
  onFocus: () => void;
  onAction: (kind: RmActionKind) => void;
}) {
  const position = flowPosition(item);
  const due = dueLabel(item.dueAt);
  const action = nextAction(item);
  const eligible = isBulkDataEntryEligible(item);
  const percent = item.checks.total
    ? Math.round((item.checks.completed / item.checks.total) * 100)
    : 0;
  const more: Array<{ label: string; kind: RmActionKind }> = [
    ...(item.intakeStage === "READY"
      ? [{ label: "Return to Data Entry", kind: "send-back" as const }]
      : []),
    ...(item.intakeStage === "DATA_ENTRY" || item.intakeStage === "CORRECTION"
      ? [{ label: "Change Data Entry", kind: "data-entry" as const }]
      : []),
    ...(canRaiseInsufficiency(item.status)
      ? [{ label: "Raise insufficiency", kind: "insufficiency" as const }]
      : []),
    ...(item.status === "STOPPED"
      ? [{ label: "Resume case", kind: "stop" as const }]
      : canStop(item.status)
        ? [{ label: "Stop case", kind: "stop" as const }]
        : []),
  ];

  return (
    <tr
      className={`${focused ? "is-focused" : ""} ${item.escalation ? "is-escalated" : ""} ${selected ? "bg-blue-50/45" : ""}`}
    >
      {showSelect ? (
        <td className="oa-check">
          <input
            type="checkbox"
            checked={selected}
            disabled={!eligible || (!selected && selectionLimitReached)}
            onChange={() => onToggleSelect?.()}
            aria-label={`Select ${item.candidateName} (${item.caseNumber})`}
            title={!eligible ? "Only Assign Data Entry cases can be bulk-assigned" : undefined}
          />
        </td>
      ) : null}
      <td>
        <button
          type="button"
          className="rmo-candidate"
          onClick={onFocus}
          aria-pressed={focused}
          aria-label={`Show details for ${item.candidateName}`}
        >
          <strong>{item.candidateName}</strong>
          <small>
            {item.client.name} · {item.caseNumber}
          </small>
        </button>
      </td>
      {show("stage") ? (
        <td>
          {item.escalation ? (
            <span className="rmo-pill is-bad" title={item.escalation.note ?? "Escalated"}>
              Escalated
            </span>
          ) : null}
          <span className={`rmo-pill is-${position.tone}`}>{position.label}</span>
          {item.openInsufficiency.l1 ? (
            <span className="rmo-pill is-warn">L1 {item.openInsufficiency.l1}</span>
          ) : null}
          {item.openInsufficiency.l2 ? (
            <span className="rmo-pill is-warn">L2 {item.openInsufficiency.l2}</span>
          ) : null}
        </td>
      ) : null}
      {show("working") ? (
        <td>
          <span className="rmo-person">
            <span className="rmo-avatar" aria-hidden>
              {initialsOf(position.holder)}
            </span>
            <span className="min-w-0">
              {position.holder}
              {item.intakeStage === "DATA_ENTRY" || item.intakeStage === "CORRECTION" ? (
                <small>since {sinceLabel(item.dataEntryAssignedAt)}</small>
              ) : null}
            </span>
          </span>
        </td>
      ) : null}
      {show("checks") ? (
        <td>
          <span className="rmo-progress" title={`${item.checks.completed} of ${item.checks.total}`}>
            <span className="rmo-meter">
              <span style={{ width: `${percent}%` }} />
            </span>
            {item.checks.completed}/{item.checks.total}
          </span>
        </td>
      ) : null}
      {show("documents") ? (
        <td>
          {item.documents.total}
          {item.documents.rejected ? (
            <span className="rmo-pill is-bad">{item.documents.rejected} sent back</span>
          ) : null}
        </td>
      ) : null}
      {show("due") ? (
        <td>
          <span className={`rmo-due is-${due.tone}`}>{due.text}</span>
        </td>
      ) : null}
      {show("received") ? <td className="rmo-muted">{sinceLabel(item.createdAt)} ago</td> : null}
      <td className="is-action">
        <span className="rmo-actions">
          {action ? (
            <Button size="sm" onClick={() => onAction(action.kind)}>
              {action.label}
            </Button>
          ) : (
            <span className="rmo-muted">No action</span>
          )}
          {more.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`More actions for ${item.candidateName}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {more.map((entry) => (
                  <DropdownMenuItem key={entry.label} onSelect={() => onAction(entry.kind)}>
                    {entry.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </td>
    </tr>
  );
}
