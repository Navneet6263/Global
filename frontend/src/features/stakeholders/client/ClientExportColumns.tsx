import { useState } from "react";
import { ArrowDown, ArrowUp, Columns3, LockKeyhole } from "lucide-react";
import { Button } from "@/kit";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { defaultColumns, exportColumns, moveColumn, type ExportKind } from "./client-export-model";

export function ClientExportColumns({
  kind,
  selected,
  onChange,
}: {
  kind: ExportKind;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = exportColumns[kind];
  const ordered = [
    ...selected,
    ...available.filter((c) => !selected.includes(c.key)).map((c) => c.key),
  ];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Columns3 aria-hidden />
          Customise columns
          <span className="rounded-full bg-brand-soft px-1.5 font-mono text-[11px] leading-[18px] font-semibold text-brand">
            {selected.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 bg-surface p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-line px-6 pt-7 pb-5 text-left">
          <span className="mb-2 grid size-10 place-items-center rounded-lg bg-brand-soft text-brand">
            <Columns3 aria-hidden className="size-5" />
          </span>
          <SheetTitle className="text-lg font-semibold text-ink">Choose & order columns</SheetTitle>
          <SheetDescription className="text-sm leading-6 text-dim">
            Tick the fields you need. Move selected fields up or down to set their left-to-right
            order in the file.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <span className="text-[11px] font-semibold tracking-wider text-dim uppercase">
              {selected.length} of {available.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-brand hover:text-brand"
              onClick={() => onChange([...defaultColumns[kind]])}
            >
              Restore defaults
            </Button>
          </div>
          <ol className="grid gap-2" aria-label="Export column order">
            {ordered.map((key) => {
              const column = available.find((c) => c.key === key)!;
              const index = selected.indexOf(key),
                checked = index !== -1;
              const locked = kind !== "cases" && key === "currency";
              return (
                <li
                  key={key}
                  className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${checked ? "border-brand/40 bg-brand-soft" : "border-line bg-surface"}`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                    <input
                      className="size-4 shrink-0 cursor-pointer rounded accent-brand disabled:cursor-default"
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={(e) =>
                        onChange(
                          e.target.checked ? [...selected, key] : selected.filter((v) => v !== key),
                        )
                      }
                    />
                    <span>{column.label}</span>
                    {locked && <LockKeyhole aria-hidden className="size-3 shrink-0 text-dim" />}
                  </label>
                  {checked && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <span className="mr-1 font-mono text-[11px] font-semibold text-brand">
                        {index + 1}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 hover:bg-surface"
                        disabled={index === 0}
                        aria-label={`Move ${column.label} up`}
                        onClick={() => onChange(moveColumn(selected, index, -1))}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 hover:bg-surface"
                        disabled={index === selected.length - 1}
                        aria-label={`Move ${column.label} down`}
                        onClick={() => onChange(moveColumn(selected, index, 1))}
                      >
                        <ArrowDown aria-hidden />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {kind !== "cases" && (
            <p className="mt-4 text-xs leading-5 text-dim">
              Currency stays included so amounts cannot be mistaken for a different currency.
            </p>
          )}
          {!selected.length && (
            <p role="status" className="mt-4 text-sm text-warn">
              Select at least one column to export.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line bg-subtle/50 px-6 py-4">
          <p className="text-xs text-dim">Changes appear in your preview.</p>
          <SheetClose asChild>
            <Button variant="primary" className="px-6">
              Done
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
