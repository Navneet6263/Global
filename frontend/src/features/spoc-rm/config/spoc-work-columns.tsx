import { StatusBadge } from "@/components/feedback/status-badge";
import type {
  SpocClientRow,
  SpocInvoiceRow,
  SpocOpportunityRow,
  SpocVisitRow,
} from "../contracts/spoc";
import { SpocCell, type SpocColumn } from "../components/SpocDataTable";
import { date, label, money, relative } from "../utils/spoc-format";
import { statusTone } from "./spoc-meta";

export const visitColumns: readonly SpocColumn<SpocVisitRow>[] = [
  {
    key: "case",
    header: "Case",
    cell: (row) => (
      <SpocCell primary={row.candidateName} secondary={`${row.caseNumber} · ${row.clientName}`} />
    ),
  },
  {
    key: "address",
    header: "Address",
    cell: (row) => <span className="line-clamp-2">{row.address}</span>,
  },
  {
    key: "status",
    header: "Visit status",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
  {
    key: "assignee",
    header: "Field executive",
    cell: (row) => row.assignee?.displayName ?? "Unassigned",
  },
  {
    key: "gps",
    header: "GPS",
    cell: (row) =>
      row.checkedInAt ? (
        <SpocCell
          primary={row.outsideGeofence ? "Outside geofence" : "Inside geofence"}
          secondary={`${Math.round(row.distanceMeters ?? 0)} m of ${row.geofenceMeters} m · ${relative(row.checkedInAt)}`}
        />
      ) : (
        "Not checked in"
      ),
  },
  { key: "evidence", header: "Evidence", cell: (row) => `${row.evidenceCount} file(s)` },
  { key: "due", header: "Case due", cell: (row) => date(row.caseDueAt) },
];

export const opportunityColumns: readonly SpocColumn<SpocOpportunityRow>[] = [
  {
    key: "company",
    header: "Company",
    cell: (row) => (
      <SpocCell
        primary={row.companyName}
        secondary={[row.contactName, row.city].filter(Boolean).join(" · ")}
      />
    ),
  },
  {
    key: "stage",
    header: "Stage",
    cell: (row) => <StatusBadge label={label(row.stage)} tone={statusTone(row.stage)} />,
  },
  {
    key: "value",
    header: "Value",
    cell: (row) => (
      <SpocCell primary={money(row.estimatedValue)} secondary={`${row.probability}% probability`} />
    ),
  },
  { key: "owner", header: "Owner", cell: (row) => row.owner?.displayName ?? "Unassigned" },
  {
    key: "followUp",
    header: "Next follow-up",
    cell: (row) => (
      <span className={row.followUpOverdue ? "font-semibold text-critical-foreground" : undefined}>
        {row.nextFollowUpAt ? date(row.nextFollowUpAt) : "None"}
        {row.followUpOverdue ? " · overdue" : ""}
      </span>
    ),
  },
  {
    key: "onboarding",
    header: "Onboarding",
    cell: (row) =>
      row.client ? (
        <SpocCell
          primary={row.client.displayName}
          secondary={`${label(row.client.status)} · handed off ${date(row.onboardingHandoffAt)}`}
        />
      ) : row.stage === "WON" ? (
        "Hand-off pending"
      ) : (
        "—"
      ),
  },
];

export const invoiceColumns: readonly SpocColumn<SpocInvoiceRow>[] = [
  {
    key: "invoice",
    header: "Invoice",
    cell: (row) => <SpocCell primary={row.invoiceNumber} secondary={row.client.displayName} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />,
  },
  {
    key: "dates",
    header: "Issued / due",
    cell: (row) => <SpocCell primary={date(row.issuedAt)} secondary={`Due ${date(row.dueAt)}`} />,
  },
  {
    key: "total",
    header: "Total",
    className: "text-right",
    cell: (row) => <span className="num">{money(row.totalAmount)}</span>,
  },
  {
    key: "paid",
    header: "Paid + credited",
    className: "text-right",
    cell: (row) => <span className="num">{money(row.paidAmount + row.creditedAmount)}</span>,
  },
  {
    key: "balance",
    header: "Balance",
    className: "text-right",
    cell: (row) => <span className="num font-semibold">{money(row.balance)}</span>,
  },
];

export const clientColumns: readonly SpocColumn<SpocClientRow>[] = [
  {
    key: "client",
    header: "Client",
    cell: (row) => <SpocCell primary={row.displayName} secondary={row.code} />,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge label={label(row.status)} tone={statusTone(row.status)} />
        {row.creditHold ? <StatusBadge label="Credit hold" tone="critical" /> : null}
      </div>
    ),
  },
  {
    key: "cases",
    header: "Cases",
    cell: (row) => (
      <SpocCell
        primary={`${row.active} active / ${row.total}`}
        secondary={`${row.completed} completed`}
      />
    ),
  },
  {
    key: "client-side",
    header: "Waiting on client",
    cell: (row) => (
      <SpocCell
        primary={row.waitingOnClient}
        secondary={`${row.openClarifications} open clarification(s)`}
      />
    ),
  },
  {
    key: "overdue",
    header: "Overdue",
    cell: (row) => (
      <span className={row.overdue ? "font-semibold text-critical-foreground" : undefined}>
        {row.overdue}
      </span>
    ),
  },
  {
    key: "finance",
    header: "Outstanding",
    className: "text-right",
    cell: (row) => (
      <SpocCell
        primary={money(row.outstanding)}
        secondary={row.overdueAmount ? `${money(row.overdueAmount)} overdue` : undefined}
      />
    ),
  },
  {
    key: "onboarding",
    header: "Onboarded",
    cell: (row) => (row.onboardingHandoffAt ? date(row.onboardingHandoffAt) : "—"),
  },
];
