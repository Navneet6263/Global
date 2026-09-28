import { StatusBadge } from "@/components/feedback/status-badge";
import type { SpocCaseRow, SpocQaRow, SpocTaskRow } from "../contracts/spoc";
import { SpocCell, type SpocColumn } from "../components/SpocDataTable";
import { date, label, relative } from "../utils/spoc-format";
import { HOLDER_LABEL, statusTone } from "./spoc-meta";

function due(value: string | null, overdue: boolean) {
  return (
    <span className={overdue ? "font-semibold text-critical-foreground" : undefined}>
      {value ? date(value) : "No due date"}
      {overdue ? " · overdue" : ""}
    </span>
  );
}

export const caseColumns: readonly SpocColumn<SpocCaseRow>[] = [
  {
    key: "case",
    header: "Case",
    cell: (row) => (
      <SpocCell
        primary={row.candidateName}
        secondary={`${row.caseNumber}${row.externalRef ? ` · ${row.externalRef}` : ""}`}
      />
    ),
  },
  {
    key: "client",
    header: "Client",
    cell: (row) => <SpocCell primary={row.client.displayName} secondary={row.branch?.name} />,
  },
  {
    key: "stage",
    header: "Stage",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
  {
    key: "holder",
    header: "With / owner",
    cell: (row) => (
      <SpocCell primary={HOLDER_LABEL[row.holderRole]} secondary={row.currentOwner ?? undefined} />
    ),
  },
  {
    key: "priority",
    header: "Priority",
    cell: (row) => <SpocCell primary={label(row.priority)} secondary={label(row.riskLevel)} />,
  },
  {
    key: "progress",
    header: "Progress",
    cell: (row) => (
      <SpocCell
        primary={`${row.checksCompleted}/${row.checksTotal} checks`}
        secondary={
          [
            row.blockedTasks ? `${row.blockedTasks} blocked` : "",
            row.openVisits ? `${row.openVisits} open visit(s)` : "",
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
    ),
  },
  { key: "due", header: "SLA due", cell: (row) => due(row.dueAt, row.overdue) },
  { key: "updated", header: "Updated", cell: (row) => relative(row.updatedAt) },
];

export const taskColumns: readonly SpocColumn<SpocTaskRow>[] = [
  {
    key: "case",
    header: "Case",
    cell: (row) => (
      <SpocCell primary={row.candidateName} secondary={`${row.caseNumber} · ${row.clientName}`} />
    ),
  },
  {
    key: "check",
    header: "Check",
    cell: (row) => (
      <SpocCell
        primary={label(row.checkType)}
        secondary={row.result ? label(row.result) : "Result pending"}
      />
    ),
  },
  {
    key: "status",
    header: "Task status",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
  { key: "assignee", header: "Verifier", cell: (row) => row.assignee?.displayName ?? "Unassigned" },
  { key: "due", header: "Due", cell: (row) => due(row.dueAt, row.overdue) },
  {
    key: "blocker",
    header: "Blocker",
    cell: (row) => <span className="line-clamp-2">{row.blockerReason ?? "—"}</span>,
  },
];

export const qaColumns: readonly SpocColumn<SpocQaRow>[] = [
  {
    key: "case",
    header: "Case",
    cell: (row) => (
      <SpocCell primary={row.candidateName} secondary={`${row.caseNumber} · ${row.clientName}`} />
    ),
  },
  {
    key: "stage",
    header: "Case stage",
    cell: (row) => <StatusBadge label={label(row.caseStatus)} tone={statusTone(row.caseStatus)} />,
  },
  { key: "reviewer", header: "Reviewer", cell: (row) => row.reviewer ?? "Unclaimed" },
  {
    key: "decision",
    header: "Decision",
    cell: (row) =>
      row.decision ? (
        <SpocCell primary={label(row.decision)} secondary={date(row.decidedAt)} />
      ) : (
        <SpocCell
          primary="Awaiting decision"
          secondary={row.claimedAt ? `Claimed ${relative(row.claimedAt)}` : undefined}
        />
      ),
  },
  { key: "priority", header: "Priority", cell: (row) => label(row.priority) },
  { key: "due", header: "SLA due", cell: (row) => date(row.dueAt) },
];
