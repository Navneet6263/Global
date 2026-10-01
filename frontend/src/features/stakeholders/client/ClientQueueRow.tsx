import { Eye, CircleCheck, Clock3, CircleAlert, CircleX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseListItem } from "@/lib/api/cases";
import {
  caseStatusLabel,
  formatDate,
  statusTone,
  terminalCaseStatuses,
} from "./client-portal-utils";

export function ClientQueueRow({
  item,
  onOpen,
  disabled,
}: {
  item: CaseListItem;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  const closed = terminalCaseStatuses.has(item.status);
  const needsAction = ["DOCUMENT_PENDING", "CLARIFICATION_PENDING", "CONSENT_PENDING"].includes(
    item.status,
  );
  const action = needsAction ? "View request" : closed ? "View case" : "Track case";
  const Icon =
    item.status === "CANCELLED"
      ? CircleX
      : closed
        ? CircleCheck
        : needsAction
          ? CircleAlert
          : Clock3;
  const description = (
    {
      DRAFT: "Case being prepared",
      CONSENT_PENDING: "Consent pending",
      DOCUMENT_PENDING: "Candidate upload pending",
      IN_PROGRESS: "Checks underway",
      CLARIFICATION_PENDING: "Additional details requested",
      QA_REVIEW: "Evidence under review",
      MANAGER_REVIEW: "Awaiting final approval",
      REPORT_PENDING: "Report being prepared",
      PAYMENT_PENDING: "Awaiting release clearance",
      COMPLETED: "Verification finished",
      CLOSED: "Workflow closed",
      CANCELLED: "Verification cancelled",
    } as Record<string, string>
  )[item.status];
  return (
    <tr>
      <td>
        <strong className="client-candidate-name">{item.subject.fullName}</strong>
        <span className="client-case-number">{item.caseNumber}</span>
      </td>
      <td>
        <div className={`client-row-status ${statusTone(item.status)}`}>
          <Icon aria-hidden />
          <div>
            <span>{caseStatusLabel(item.status)}</span>
            <small>{description}</small>
          </div>
        </div>
      </td>
      <td>
        <div className="client-check-progress">
          <span>
            {completed}/{item.checks.length}
          </span>
          <span className="client-check-track" aria-hidden>
            <i
              style={{
                width: `${item.checks.length ? (completed / item.checks.length) * 100 : 0}%`,
                background: completed === item.checks.length && completed ? "#15803d" : "#1d4ed8",
              }}
            />
          </span>
        </div>
      </td>
      <td>
        {item.dueAt ? (
          <time dateTime={item.dueAt}>{formatDate(item.dueAt)}</time>
        ) : (
          <span className="text-muted-foreground">Not set</span>
        )}
      </td>
      <td>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onOpen}
          className="client-open-case"
          aria-label={`Open case for ${item.subject.fullName}`}
        >
          <Eye aria-hidden />
          {action}
        </Button>
      </td>
    </tr>
  );
}
