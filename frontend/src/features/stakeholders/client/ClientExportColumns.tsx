import { useState } from "react";
import { ArrowDown, ArrowUp, Columns3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        <Button
          variant="outline"
          className="h-10 rounded-lg border-slate-200 bg-white text-slate-700 shadow-none"
        >
          <Columns3 aria-hidden />
          Customise columns
          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-bold text-blue-700">
            {selected.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 bg-white p-0 sm:max-w-[440px]">
        <SheetHeader className="border-b border-slate-100 px-6 pt-7 pb-5 text-left">
          <span className="mb-2 grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <Columns3 aria-hidden className="size-5" />
          </span>
          <SheetTitle className="text-xl font-bold text-slate-900">
            Choose & order columns
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-slate-500">
            Tick the fields you need. Move selected fields up or down to set their left-to-right
            order in the file.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-500">
              {selected.length} of {available.length} selected
            </span>
            <button
              className="rounded px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50"
              onClick={() => onChange([...defaultColumns[kind]])}
            >
              Restore defaults
            </button>
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
                  className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${checked ? "border-blue-100 bg-blue-50/50" : "border-slate-100 bg-white"}`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm font-medium text-slate-800">
                    <input
                      className="size-4 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600 disabled:cursor-default"
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
                    {locked && (
                      <LockKeyhole aria-hidden className="size-3 shrink-0 text-slate-400" />
                    )}
                  </label>
                  {checked && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <span className="mr-1 text-[11px] font-bold text-blue-500">{index + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-md text-slate-500 hover:bg-blue-100"
                        disabled={index === 0}
                        aria-label={`Move ${column.label} up`}
                        onClick={() => onChange(moveColumn(selected, index, -1))}
                      >
                        <ArrowUp aria-hidden />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-md text-slate-500 hover:bg-blue-100"
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
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Currency stays included so amounts cannot be mistaken for a different currency.
            </p>
          )}
          {!selected.length && (
            <p role="status" className="mt-4 text-sm text-amber-700">
              Select at least one column to export.
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <p className="text-xs text-slate-500">Changes appear in your preview.</p>
          <SheetClose asChild>
            <Button className="h-10 rounded-lg bg-blue-600 px-6 text-white hover:bg-blue-700">
              Done
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
