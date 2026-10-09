import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveBlob } from "@/lib/backend-api/client";
import { logExport, type ExportSource } from "@/lib/backend-api/exports";
import { exportCsv, moveColumn } from "@/features/stakeholders/client/client-export-model";

export interface SheetColumn<R> {
  key: string;
  label: string;
  value: (row: R) => string | number | null | undefined;
}

function readSaved(storageKey: string, known: readonly string[]) {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (Array.isArray(saved)) {
      const keys = saved.filter((key): key is string => known.includes(key as string));
      if (keys.length) return keys;
    }
  } catch {
    /* Storage unavailable: use defaults. */
  }
  return null;
}

/**
 * "Export" button: pick and order the columns, then download every matching row as CSV.
 * The choice is remembered per list; each download is recorded in the audit trail.
 */
export function ExportSheetButton<R>({
  source,
  title,
  filename,
  columns,
  defaults,
  loadRows,
  download: serverDownload,
  scopeNote,
  disabled,
}: {
  source: ExportSource;
  title: string;
  filename: string;
  columns: readonly SheetColumn<R>[];
  defaults: readonly string[];
  /** Loads every row the current filters match (bounded by the caller). */
  loadRows?: () => Promise<R[]>;
  /** Server-built sheet instead (the server audits it): receives the chosen column keys. */
  download?: (columns: string[]) => Promise<void>;
  /** What the rows are, e.g. "Waiting for a member · search “acme”". */
  scopeNote?: string;
  disabled?: boolean;
}) {
  const storageKey = `export-columns:${source}`;
  const known = columns.map((column) => column.key);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([...defaults]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setSelected(readSaved(storageKey, known) ?? [...defaults]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload the saved choice on open
  }, [open]);
  const remember = (next: string[]) => {
    setSelected(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Session-only preference. */
    }
  };
  const chosen = selected
    .map((key) => columns.find((column) => column.key === key))
    .filter((column): column is SheetColumn<R> => Boolean(column));
  const available = columns.filter((column) => !selected.includes(column.key));
  const download = async () => {
    setBusy(true);
    try {
      if (serverDownload) {
        await serverDownload(chosen.map((column) => column.key));
        toast.success("Sheet downloaded");
        setOpen(false);
        return;
      }
      const rows = loadRows ? await loadRows() : [];
      if (!rows.length) {
        toast.info("Nothing to export", { description: "No rows match the current view." });
        return;
      }
      const csv = exportCsv(
        rows.map((row) =>
          Object.fromEntries(chosen.map((column) => [column.key, column.value(row) ?? ""])),
        ),
        chosen.map(({ key, label }) => ({ key, label })),
      );
      const stamp = new Date().toISOString().slice(0, 10);
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}-${stamp}.csv`);
      void logExport({ source, rows: rows.length, columns: chosen.map((c) => c.key) }).catch(
        () => undefined,
      );
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
      setOpen(false);
    } catch (error) {
      toast.error("Export failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        <FileSpreadsheet aria-hidden /> Export
      </Button>
      <Dialog open={open} onOpenChange={(next) => (!busy ? setOpen(next) : undefined)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="border-b border-slate-100 px-6 py-5">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-blue-600" aria-hidden /> {title}
            </DialogTitle>
            <DialogDescription>
              Pick the columns and their order. {scopeNote ? `Rows: ${scopeNote}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 overflow-y-auto px-6 py-5">
            <section aria-label="Columns in your sheet">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                In your sheet ({chosen.length})
              </p>
              <ol className="grid gap-1.5">
                {chosen.map((column, index) => (
                  <li
                    key={column.key}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="w-5 text-center text-xs font-semibold text-slate-400">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-slate-800">
                      {column.label}
                    </span>
                    <button
                      type="button"
                      aria-label={`Move ${column.label} up`}
                      disabled={index === 0}
                      onClick={() => remember(moveColumn(selected, index, -1))}
                      className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowUp className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${column.label} down`}
                      disabled={index === chosen.length - 1}
                      onClick={() => remember(moveColumn(selected, index, 1))}
                      className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${column.label}`}
                      disabled={chosen.length === 1}
                      onClick={() => remember(selected.filter((key) => key !== column.key))}
                      className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            {available.length ? (
              <section aria-label="More columns">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Add a column
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {available.map((column) => (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => remember([...selected, column.key])}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-[12.5px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Plus className="size-3" aria-hidden /> {column.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
          <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-slate-100 px-6 py-4 sm:justify-between">
            <button
              type="button"
              className="text-[12.5px] font-semibold text-slate-500 hover:text-slate-800"
              onClick={() => remember([...defaults])}
            >
              Reset columns
            </button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" loading={busy} onClick={() => void download()}>
                <Download aria-hidden /> Download CSV
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
