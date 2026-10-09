import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ColumnOption } from "./use-column-choice";

export type { ColumnOption };

/** "Columns" menu: tick what you want to see; only those columns are shown. */
export function ColumnPicker<K extends string>({
  options,
  value,
  defaults,
  fixedLabel,
  onChange,
  label = "Columns",
  heading = "Show in your table",
}: {
  options: readonly ColumnOption<K>[];
  value: readonly K[];
  defaults: readonly K[];
  /** Columns that are always shown, e.g. "Candidate and action". */
  fixedLabel: string;
  onChange: (next: K[]) => void;
  label?: string;
  heading?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-lg border-slate-200 bg-white text-xs shadow-none"
        >
          <Columns3 className="size-4" aria-hidden />
          {label}
          <span className="rounded bg-slate-100 px-1.5 text-slate-500">{value.length}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl p-2">
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
        <p className="px-2 pb-2 text-xs text-slate-500">{fixedLabel} always stay visible.</p>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.key}
            checked={value.includes(option.key)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(checked ? [...value, option.key] : value.filter((key) => key !== option.key))
            }
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange([...defaults])}>
          Restore defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
