import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ClientExportPreview } from "./ClientExportPreview";
import { ClientExportFilters } from "./ClientExportFilters";
import { loadClientExport } from "./client-export-loader";
import {
  defaultColumns,
  type ExportKind,
  type ExportRow,
  type ExportFilters,
} from "./client-export-model";

const emptyFilters: ExportFilters = { search: "", status: "", from: "", to: "" };
export function ClientCustomExport() {
  const [kind, setKind] = useState<ExportKind>("cases");
  const [selected, setSelected] = useState(defaultColumns.cases);
  const [filters, setFilters] = useState(emptyFilters);
  const [result, setResult] = useState<{ rows: ExportRow[]; at: string }>();
  const [busy, setBusy] = useState(false),
    [count, setCount] = useState(0),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function changeFilters(value: ExportFilters) {
    setFilters(value);
    setResult(undefined);
    setError("");
  }
  async function prepare() {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setResult(undefined);
    setError("");
    setCount(0);
    try {
      const rows = await loadClientExport(kind, filters, current.signal, setCount);
      if (!current.signal.aborted) setResult({ rows, at: new Date().toLocaleString("en-IN") });
    } catch (err) {
      if (!current.signal.aborted)
        setError(err instanceof Error ? err.message : "Could not prepare this export.");
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  function cancel() {
    controller.current?.abort();
    setBusy(false);
    setError("Preparation cancelled. No file was downloaded.");
  }
  return (
    <div className="grid min-w-0 gap-5" data-testid="custom-export-builder">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <FileSpreadsheet aria-hidden className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Build your own report
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Filter your data. Choose your columns. Export what matters.
              </p>
            </div>
          </div>
          <label className="grid w-full gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500 sm:w-56">
            Report type
            <select
              className="h-10 w-full rounded-lg border border-blue-100 bg-blue-50/50 px-3 text-sm font-semibold tracking-normal text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
              value={kind}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value as ExportKind;
                setKind(next);
                setSelected([...defaultColumns[next]]);
                changeFilters(emptyFilters);
              }}
            >
              <option value="cases">Verification data</option>
              <option value="invoices">Invoice details</option>
              <option value="spend">Expense summary</option>
            </select>
          </label>
        </header>
        <div className="grid gap-4 p-5">
          <ClientExportFilters
            kind={kind}
            value={filters}
            onChange={changeFilters}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <Info aria-hidden className="size-3.5 shrink-0 text-blue-500" />
              {kind === "cases"
                ? "Date range: case creation · IST"
                : "Date range: invoice issue date · IST"}
            </p>
            <div className="flex flex-wrap gap-2">
              {busy ? (
                <Button variant="outline" className="h-10 rounded-lg" onClick={cancel}>
                  Cancel preparation
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="h-10 rounded-lg text-slate-500"
                  onClick={() => {
                    changeFilters(emptyFilters);
                    setSelected([...defaultColumns[kind]]);
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                className="h-10 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                loading={busy}
                disabled={busy}
                onClick={() => void prepare()}
              >
                <RefreshCw aria-hidden />
                {busy ? `Preparing… ${count} records checked` : "Apply filters & preview"}
              </Button>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </section>
      <ClientExportPreview
        kind={kind}
        selected={selected}
        onChange={setSelected}
        result={result}
        busy={busy}
      />
      <p className="px-1 text-xs leading-5 text-slate-500">
        Excel-compatible CSV · Up to 10,000 source records; larger requests stop without a partial
        file.
        {kind === "cases"
          ? " Data exports do not replace signed verification reports."
          : " Payments are current recorded totals, not payment-date transactions. Currency stays included."}
        {kind === "spend" &&
          " Cancelled invoices are excluded; currencies are summarised separately."}{" "}
        No identity documents are included.
      </p>
    </div>
  );
}
