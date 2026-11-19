import { Eye, CircleCheck, Clock3, CircleAlert, CircleX } from "lucide-react";
import { Avatar, Button, Chip, Meter, Td } from "@/kit";
import { cn } from "@/lib/utils";
import type { CaseListItem } from "@/lib/api/cases";
import type { QueueColumn } from "./client-queue-columns";
import { casePackageName } from "@/lib/backend-api/case-services";
import { ClientReportDownloadButton } from "./ClientReportReady";
import { clientStatus, formatDate, tatText, terminalCaseStatuses } from "./client-portal-utils";

const ICON_TONE = {
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  note: "text-note",
  brand: "text-brand",
} as const;

export function ClientQueueRow({
  item,
  onOpen,
  disabled,
  columns,
}: {
  item: CaseListItem;
  onOpen: () => void;
  disabled?: boolean;
  columns: QueueColumn[];
}) {
  const completed = item.checks.filter((check) => check.status === "COMPLETED").length;
  const closed = terminalCaseStatuses.has(item.status);
  const shown = clientStatus(item);
  // Documents received: the next move is the team's, not the client's.
  const needsAction =
    shown.stage === "YOUR_REVIEW" ||
    (shown.stage !== "DOCUMENTS_RECEIVED" &&
      ["DOCUMENT_PENDING", "CLARIFICATION_PENDING", "CONSENT_PENDING"].includes(item.status));
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
      DOCUMENT_PENDING:
        shown.stage === "DOCUMENTS_RECEIVED"
          ? "Candidate uploaded everything · our team is checking"
          : shown.stage === "YOUR_REVIEW"
            ? "Approve the documents to start verification"
            : shown.stage === "CORRECTION"
              ? "A correction was requested"
              : "Candidate upload pending",
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
    <tr
      className="cursor-pointer last:[&>td]:border-b-0 hover:bg-subtle/50"
      onClick={(event) => {
        // The whole row opens the case (Task style); its own buttons and links still work.
        if ((event.target as HTMLElement).closest("button, a") || disabled) return;
        onOpen();
      }}
    >
      <Td data-column="candidate">
        <div className="flex min-w-[170px] items-center gap-2.5">
          <Avatar name={item.subject.fullName} />
          <div className="min-w-0">
            <strong className="block truncate font-semibold text-ink">
              {item.subject.fullName}
            </strong>
            <span className="font-mono text-xs text-dim">{item.caseNumber}</span>
          </div>
        </div>
      </Td>
      {columns.includes("status") && (
        <Td data-column="status">
          <div className="flex min-w-[210px] flex-col items-start gap-1">
            <Chip tone={shown.kind}>
              <Icon className={cn("size-3.5", ICON_TONE[shown.kind])} aria-hidden />
              {shown.label}
            </Chip>
            <small className="pl-1 text-xs text-dim">
              {item.report ? "Report ready to download" : description}
            </small>
          </div>
        </Td>
      )}
      {columns.includes("checks") && (
        <Td>
          <div className="flex w-28 flex-col gap-1">
            <span className="font-mono text-xs text-ink">
              {completed}/{item.checks.length}
              <span className="ml-1 font-sans text-dim">checks</span>
            </span>
            <Meter
              value={completed}
              max={item.checks.length}
              tone={completed === item.checks.length && completed ? "good" : "brand"}
              label={`${completed} of ${item.checks.length} checks done`}
            />
          </div>
        </Td>
      )}
      {columns.includes("due") && (
        <Td className="whitespace-nowrap">
          {item.tatWorkingDays ? (
            tatText(item.tatWorkingDays)
          ) : (
            <span className="text-dim">Not set</span>
          )}
        </Td>
      )}
      {columns.includes("package") && <Td>{casePackageName(item)}</Td>}
      {columns.includes("priority") && <Td>{item.priority}</Td>}
      {columns.includes("updated") && (
        <Td className="whitespace-nowrap">
          <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
        </Td>
      )}
      {columns.includes("branch") && <Td>{item.branch?.name ?? "Not assigned"}</Td>}
      <Td align="right">
        <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
          {item.report ? (
            <ClientReportDownloadButton
              report={item.report}
              caseNumber={item.caseNumber}
              candidateName={item.subject.fullName}
              iconOnly
            />
          ) : null}
          <Button
            size="sm"
            disabled={disabled}
            onClick={onOpen}
            aria-label={`Open case for ${item.subject.fullName}`}
          >
            <Eye aria-hidden />
            {action}
          </Button>
        </span>
      </Td>
    </tr>
  );
}
