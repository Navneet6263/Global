import { Columns3 } from "lucide-react";
import { Button } from "@/kit";
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
        <Button size="sm">
          <Columns3 aria-hidden />
          Columns{" "}
          <span className="rounded bg-subtle px-1.5 font-mono text-dim">{columns.length + 2}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
        <DropdownMenuLabel>Show in your table</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-dim">Candidate and action always stay visible.</p>
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
