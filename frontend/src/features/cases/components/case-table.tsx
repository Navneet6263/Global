"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal } from "lucide-react";
import type { CaseQuery, VerificationCase } from "@/lib/contracts/case";
import type { CaseColumnId } from "../config/table";
import { CASE_COLUMNS } from "../config/table";
import {
  CandidateCell,
  OwnerCell,
  PriorityCell,
  ProgressCell,
  SlaCell,
  StageCell,
  UpdatedCell,
} from "./case-cells";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface CaseTableProps {
  rows: readonly VerificationCase[];
  query: CaseQuery;
  visibleColumns: readonly CaseColumnId[];
  selected: readonly string[];
  onSort: (sortBy: NonNullable<CaseQuery["sortBy"]>) => void;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpenCase: (id: string) => void;
}

export function CaseTable({
  rows,
  query,
  visibleColumns,
  selected,
  onSort,
  onToggleRow,
  onToggleAll,
  onOpenCase,
}: CaseTableProps) {
  const columns = CASE_COLUMNS.filter((column) => visibleColumns.includes(column.id));
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1080px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th scope="col" className="w-10 px-4 py-2.5">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Select all cases on this page"
              />
            </th>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className="px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {column.sortKey ? (
                  <button
                    type="button"
                    onClick={() => onSort(column.sortKey!)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    {column.label}
                    <SortIcon active={query.sortBy === column.sortKey} dir={query.sortDir} />
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
            <th scope="col" className="w-12 px-3 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              onClick={() => onOpenCase(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenCase(row.id);
                }
              }}
              className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-accent/40 focus-visible:bg-accent/50"
            >
              <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={selected.includes(row.id)}
                  onCheckedChange={() => onToggleRow(row.id)}
                  aria-label={`Select ${row.candidateName}`}
                />
              </td>
              {columns.map((column) => (
                <td key={column.id} className={cn("px-3 py-3 align-middle", column.className)}>
                  <CellContent id={column.id} row={row} />
                </td>
              ))}
              <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${row.candidateName}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 rounded-2xl">
                    <DropdownMenuItem onSelect={() => onOpenCase(row.id)}>
                      Open case drawer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: CaseQuery["sortDir"] }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="size-3 text-primary" aria-hidden />
  ) : (
    <ArrowDown className="size-3 text-primary" aria-hidden />
  );
}

function CellContent({ id, row }: { id: CaseColumnId; row: VerificationCase }) {
  switch (id) {
    case "candidate":
      return <CandidateCell row={row} />;
    case "caseNumber":
      return <span className="num text-xs text-muted-foreground">{row.caseNumber}</span>;
    case "client":
      return <span className="text-[13px] text-foreground">{row.clientName}</span>;
    case "package":
      return (
        <span className="block">
          <span className="block text-[13px] text-foreground">{row.packageName}</span>
          <span className="block text-[11px] text-muted-foreground">
            {row.checkBundle.length} checks
          </span>
        </span>
      );
    case "stage":
      return <StageCell row={row} />;
    case "progress":
      return <ProgressCell row={row} />;
    case "priority":
      return <PriorityCell row={row} />;
    case "sla":
      return <SlaCell row={row} />;
    case "owner":
      return <OwnerCell row={row} />;
    case "updated":
      return <UpdatedCell row={row} />;
    default:
      return null;
  }
}
