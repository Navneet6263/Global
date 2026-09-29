import { StatusBadge } from "@/components/feedback/status-badge";
import { SpocCell, type SpocColumn } from "@/features/spoc-rm/components/SpocDataTable";
import { HOLDER_LABEL, statusTone } from "@/features/spoc-rm/config/spoc-meta";
import { dateTime, label } from "@/features/spoc-rm/utils/spoc-format";
import type {
  SupportClientRow,
  SupportEmployeeRow,
  SupportRequestRow,
} from "../api/support-contracts";
import {
  CASE_STATE_META,
  REQUESTER_LABEL,
  REQUEST_STATUS_META,
  documentSummary,
} from "../support-model";

export const CLIENT_COLUMNS: readonly SpocColumn<SupportClientRow>[] = [
  {
    key: "client",
    header: "Client",
    cell: (row) => <SpocCell primary={row.displayName} secondary={row.code} />,
  },
  {
    key: "employees",
    header: "Employees",
    cell: (row) => (
      <SpocCell
        primary={row.employees}
        secondary={`${row.active} in progress · ${row.completed} completed`}
      />
    ),
  },
  {
    key: "exceptions",
    header: "Needs attention",
    cell: (row) =>
      row.exceptions ? (
        <StatusBadge label={String(row.exceptions)} tone="critical" />
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    key: "requests",
    header: "Open requests",
    cell: (row) =>
      row.openRequests ? (
        <StatusBadge label={String(row.openRequests)} tone="warning" />
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  { key: "updated", header: "Last updated", cell: (row) => dateTime(row.lastUpdated) },
  {
    key: "status",
    header: "Client status",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
];

export const EMPLOYEE_COLUMNS: readonly SpocColumn<SupportEmployeeRow>[] = [
  {
    key: "employee",
    header: "Employee",
    cell: (row) => <SpocCell primary={row.candidateName} secondary={row.caseNumber} />,
  },
  { key: "client", header: "Client", cell: (row) => row.client.displayName },
  {
    key: "stage",
    header: "Current stage",
    cell: (row) => (
      <SpocCell
        primary={label(row.status)}
        secondary={`With ${HOLDER_LABEL[row.holderRole]}${row.currentOwner ? ` · ${row.currentOwner}` : ""}`}
      />
    ),
  },
  {
    key: "documents",
    header: "Documents",
    cell: (row) => <span className="text-muted-foreground">{documentSummary(row.documents)}</span>,
  },
  {
    key: "checks",
    header: "Checks done",
    cell: (row) => `${row.checks.completed} / ${row.checks.total}`,
  },
  {
    key: "state",
    header: "Status",
    cell: (row) => (
      <div className="space-y-1">
        <StatusBadge
          label={CASE_STATE_META[row.state].label}
          tone={CASE_STATE_META[row.state].tone}
        />
        {row.exceptionReasons.length ? (
          <p className="text-[10px] text-critical-foreground">{row.exceptionReasons.join(" · ")}</p>
        ) : null}
      </div>
    ),
  },
  { key: "updated", header: "Last updated", cell: (row) => dateTime(row.updatedAt) },
];

export const REQUEST_COLUMNS: readonly SpocColumn<SupportRequestRow>[] = [
  {
    key: "request",
    header: "Request",
    cell: (row) => <SpocCell primary={row.requestNumber} secondary={dateTime(row.createdAt)} />,
  },
  {
    key: "requester",
    header: "Requester",
    cell: (row) => (
      <SpocCell primary={row.requesterName} secondary={REQUESTER_LABEL[row.requesterType]} />
    ),
  },
  {
    key: "employee",
    header: "Client / employee",
    cell: (row) => (
      <SpocCell
        primary={row.client.displayName}
        secondary={
          row.employee ? `${row.employee.candidateName} · ${row.employee.caseNumber}` : "—"
        }
      />
    ),
  },
  {
    key: "query",
    header: "Query",
    className: "max-w-[260px]",
    cell: (row) => <SpocCell primary={row.subject} secondary={row.message} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <div className="space-y-1">
        <StatusBadge
          label={REQUEST_STATUS_META[row.status].label}
          tone={REQUEST_STATUS_META[row.status].tone}
        />
        {row.takenBy ? <p className="text-[10px] text-muted-foreground">{row.takenBy}</p> : null}
      </div>
    ),
  },
  { key: "updated", header: "Last updated", cell: (row) => dateTime(row.updatedAt) },
];
