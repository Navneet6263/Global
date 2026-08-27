"use client";

import type { VerificationCase } from "@/lib/contracts/case";
import { PriorityCell, ProgressCell, SlaCell, StageCell } from "./case-cells";
import { formatRelativeToNow } from "@/lib/formatting";

interface CaseMobileListProps {
  rows: readonly VerificationCase[];
  onOpenCase: (id: string) => void;
}

export function CaseMobileList({ rows, onOpenCase }: CaseMobileListProps) {
  return (
    <ul className="space-y-3 p-4 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            onClick={() => onOpenCase(row.id)}
            className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-[var(--shadow-card)]"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {row.candidateName}
                </span>
                <span className="num block text-[11px] text-muted-foreground">
                  {row.caseNumber}
                </span>
              </span>
              <PriorityCell row={row} />
            </span>
            <span className="block text-xs text-muted-foreground">
              {row.clientName} · {row.packageName}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StageCell row={row} />
              <SlaCell row={row} />
            </span>
            <span className="flex items-center justify-between gap-3">
              <ProgressCell row={row} />
              <span className="text-[11px] text-muted-foreground">
                {formatRelativeToNow(row.updatedAt)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
