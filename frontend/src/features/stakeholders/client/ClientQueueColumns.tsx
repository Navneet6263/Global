import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { queueColumns, defaultQueueColumns, type QueueColumn } from "./client-queue-columns";

export function ClientQueueColumns({
  columns,
  onChange,
}: {
  columns: QueueColumn[];
  onChange: (columns: QueueColumn[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-lg border-slate-200 bg-white text-xs shadow-none"
        >
          <Columns3 className="size-4" />
          Columns{" "}
          <span className="rounded bg-slate-100 px-1.5 text-slate-500">{columns.length + 2}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
        <DropdownMenuLabel>Show in your table</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-slate-500">
          Candidate and action always stay visible.
        </p>
        <DropdownMenuSeparator />
        {queueColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={columns.includes(column.key)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked ? [...columns, column.key] : columns.filter((key) => key !== column.key),
              )
            }
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange(defaultQueueColumns)}>
          Restore default columns
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
