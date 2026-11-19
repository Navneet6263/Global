import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, Info, RefreshCw } from "lucide-react";
import { Button, Card, Select } from "@/kit";

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
      <Card className="min-w-0 overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
              <FileSpreadsheet aria-hidden className="size-5" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-ink">Build your own report</h2>
              <p className="mt-0.5 text-xs text-dim">
                Filter your data. Choose your columns. Export what matters.
              </p>
            </div>
          </div>
          <label className="flex w-full flex-col gap-1 text-xs font-medium text-dim sm:w-56">
            Report type
            <Select
              className="font-medium"
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
            </Select>
          </label>
        </header>
        <div className="grid gap-4 p-4">
          <ClientExportFilters
            kind={kind}
            value={filters}
            onChange={changeFilters}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-xs text-dim">
              <Info aria-hidden className="size-3.5 shrink-0 text-brand" />
              {kind === "cases"
                ? "Date range: case creation · IST"
                : "Date range: invoice issue date · IST"}
            </p>
            <div className="flex flex-wrap gap-2">
              {busy ? (
                <Button onClick={cancel}>Cancel preparation</Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    changeFilters(emptyFilters);
                    setSelected([...defaultColumns[kind]]);
                  }}
                >
                  Reset
                </Button>
              )}
              <Button
                variant="primary"
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
            <p role="alert" className="rounded-md bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
              {error}
            </p>
          )}
        </div>
      </Card>
      <ClientExportPreview
        kind={kind}
        selected={selected}
        onChange={setSelected}
        result={result}
        busy={busy}
      />
      <p className="px-1 text-xs leading-5 text-dim">
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
