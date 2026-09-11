import { ArrowUpDown } from "lucide-react";
import type { OpsCase, OpsCaseQuery } from "../contracts/case";
import { OPS_PRIORITY_META, OPS_SLA_META, OPS_STAGE_META } from "../contracts/case";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { formatDuration, formatRelativeToNow } from "@/lib/formatting";
import { Checkbox } from "@/components/ui/checkbox";
import {
  canSelectForDispatch,
  DISPATCH_LIMIT,
  type DispatchSelectionProps,
} from "../dispatch/dispatch-selection-model";

interface OpsCaseTableProps {
  rows: readonly OpsCase[];
  query: OpsCaseQuery;
  onSort: (key: NonNullable<OpsCaseQuery["sortBy"]>) => void;
  onOpenCase: (caseId: string) => void;
  selection?: DispatchSelectionProps;
}

const COLUMNS: readonly {
  key: NonNullable<OpsCaseQuery["sortBy"]> | null;
  label: string;
}[] = [
  { key: "candidateName", label: "Candidate" },
  { key: null, label: "Client / package" },
  { key: null, label: "Stage" },
  { key: "progress", label: "Checks" },
  { key: "priority", label: "Priority" },
  { key: "sla", label: "SLA" },
  { key: null, label: "Owner / verifier" },
  { key: "updatedAt", label: "Updated" },
  { key: null, label: "" },
];

export function OpsCaseTable({ rows, query, onSort, onOpenCase, selection }: OpsCaseTableProps) {
  const selectable = rows.filter(canSelectForDispatch);
  const selectedOnPage = selectable.filter((row) => selection?.selected.includes(row.id)).length;
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1080px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {selection ? (
              <th scope="col" className="w-12 px-4 py-3">
                <Checkbox
                  aria-label="Select cases on this page"
                  checked={
                    selectable.length > 0 && selectedOnPage === selectable.length
                      ? true
                      : selectedOnPage > 0
                        ? "indeterminate"
                        : false
                  }
                  disabled={
                    !selectable.length ||
                    (selection.selected.length >= DISPATCH_LIMIT && selectedOnPage === 0)
                  }
                  onCheckedChange={selection.onTogglePage}
                />
              </th>
            ) : null}
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase"
              >
                {column.key ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.key!)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {column.label}
                    <ArrowUpDown
                      className={query.sortBy === column.key ? "size-3 text-primary" : "size-3"}
                      aria-hidden
                    />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/70 transition-colors hover:bg-muted/35"
            >
              {selection ? (
                <td className="px-4 py-3">
                  <Checkbox
                    aria-label={`Select ${row.caseNumber}`}
                    checked={selection.selected.includes(row.id)}
                    disabled={
                      !canSelectForDispatch(row) ||
                      (!selection.selected.includes(row.id) &&
                        selection.selected.length >= DISPATCH_LIMIT)
                    }
                    onCheckedChange={() => selection.onToggle(row.id)}
                  />
                </td>
              ) : null}
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">{row.candidateName}</p>
                <p className="num text-[11px] text-muted-foreground">{row.caseNumber}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-[13px] text-foreground">{row.clientName}</p>
                <p className="text-[11px] text-muted-foreground">{row.packageName}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  label={OPS_STAGE_META[row.stage].short}
                  tone={OPS_STAGE_META[row.stage].tone}
                />
              </td>
              <td className="px-4 py-3">
                <p className="num text-[13px] text-foreground">
                  {row.checksCompleted}/{row.checksTotal}
                </p>
                <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary/70"
                    style={{ width: `${row.progress}%` }}
                  />
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  label={OPS_PRIORITY_META[row.priority].label}
                  tone={OPS_PRIORITY_META[row.priority].tone}
                  withDot={false}
                />
              </td>
              <td className="px-4 py-3">
                <StatusBadge
                  label={OPS_SLA_META[row.slaState].label}
                  tone={OPS_SLA_META[row.slaState].tone}
                />
                <p className="num mt-1 text-[11px] text-muted-foreground">
                  {row.slaMinutesRemaining <= 0
                    ? `overdue ${formatDuration(-row.slaMinutesRemaining)}`
                    : `${formatDuration(row.slaMinutesRemaining)} left`}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="text-[13px] text-foreground">{row.opsOwner ?? "Unassigned"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.verifier ?? "No verifier allocated"}
                </p>
              </td>
              <td className="px-4 py-3 text-[12px] text-muted-foreground">
                {formatRelativeToNow(row.updatedAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="outline" size="sm" onClick={() => onOpenCase(row.id)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
