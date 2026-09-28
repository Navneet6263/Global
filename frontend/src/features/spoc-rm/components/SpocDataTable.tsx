import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { OversightEmpty } from "@/features/admin-dashboard/components/oversight-ui";
import { cn } from "@/lib/utils";

export interface SpocColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/**
 * View-only table. Rows open details only (drawer or filtered list); there are no
 * row actions that change data.
 */
export function SpocDataTable<T extends { id: string }>({
  rows,
  columns,
  onOpen,
  openLabel,
  emptyTitle,
  emptyDetail,
  minWidth = 880,
}: {
  rows: readonly T[];
  columns: readonly SpocColumn<T>[];
  onOpen?: (row: T) => void;
  openLabel?: (row: T) => string;
  emptyTitle: string;
  emptyDetail: string;
  minWidth?: number;
}) {
  if (!rows.length) return <OversightEmpty title={emptyTitle} detail={emptyDetail} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs" style={{ minWidth }}>
        <thead className="bg-muted/35 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn("px-4 py-3 font-semibold", column.className)}
              >
                {column.header}
              </th>
            ))}
            {onOpen ? (
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">View</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("transition hover:bg-mint-soft/25", onOpen && "cursor-pointer")}
              onClick={onOpen ? () => onOpen(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-3 align-top", column.className)}>
                  {column.cell(row)}
                </td>
              ))}
              {onOpen ? (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    aria-label={openLabel?.(row) ?? "View details"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row);
                    }}
                    className="inline-grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary/35 hover:text-primary"
                  >
                    <Eye className="size-3.5" aria-hidden />
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Two-line cell: primary text plus a muted secondary line. */
export function SpocCell({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-foreground">{primary}</p>
      {secondary ? (
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{secondary}</p>
      ) : null}
    </div>
  );
}
