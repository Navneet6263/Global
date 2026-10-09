import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Columns3,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { saveBlob } from "@/lib/backend-api/client";
import { opsStageFilters } from "../workspace/ops-queue-model";
import type { Option } from "../workspace/OpsWorkQueue";
import { REPORT_ROW_LIMIT, loadReport } from "./ops-report-loader";
import {
  cellText,
  emptyReportFilters,
  moveKey,
  reportColumns,
  reportCsv,
  reportPresets,
  type ReportColumnKey,
  type ReportFilters,
  type ReportPresetId,
  type ReportRow,
} from "./ops-report-model";
import { buildXlsx } from "./xlsx-writer";

const label = (key: ReportColumnKey) => reportColumns.find((column) => column.key === key)!.label;

export function OpsReportBuilder({ clients, rms }: { clients: Option[]; rms: Option[] }) {
  const [preset, setPreset] = useState<ReportPresetId>("status");
  const [keys, setKeys] = useState<ReportColumnKey[]>([...reportPresets[0].columns]);
  const [filters, setFilters] = useState<ReportFilters>(emptyReportFilters);
  const [result, setResult] = useState<{
    rows: ReportRow[];
    total: number;
    truncated: boolean;
    at: string;
  }>();
  const [progress, setProgress] = useState<{ loaded: number; total: number }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const current = reportPresets.find((item) => item.id === preset)!;

  const reset = () => {
    controller.current?.abort();
    setResult(undefined);
    setError("");
    setBusy(false);
  };
  const choosePreset = (id: ReportPresetId) => {
    setPreset(id);
    setKeys([...reportPresets.find((item) => item.id === id)!.columns]);
    reset();
  };
  const patch = (next: Partial<ReportFilters>) => {
    setFilters((value) => ({ ...value, ...next }));
    reset();
  };

  async function prepare() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setResult(undefined);
    setProgress(undefined);
    try {
      const data = await loadReport(preset, filters, abort.signal, (loaded, total) =>
        setProgress({ loaded, total }),
      );
      if (!abort.signal.aborted)
        setResult({
          ...data,
          at: new Date().toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }),
        });
    } catch (failure) {
      if (!abort.signal.aborted)
        setError(failure instanceof Error ? failure.message : "Could not prepare this report.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }

  const fileBase = `Sapling-${current.label.replace(/[^A-Za-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;
  const filterSummary = [
    filters.from || filters.to
      ? `Initiated ${filters.from || "…"} to ${filters.to || "…"}`
      : "All dates",
    filters.clientId ? clients.find((c) => c.value === filters.clientId)?.label : "All clients",
    filters.ownerId ? `RM ${rms.find((r) => r.value === filters.ownerId)?.label ?? ""}` : null,
    filters.scope === "active"
      ? "Active only"
      : filters.scope === "completed"
        ? "Completed only"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const downloadXlsx = () => {
    if (!result?.rows.length || !keys.length) return;
    const bytes = buildXlsx([
      {
        name: current.label,
        title: `Sapling Global — ${current.label}`,
        subtitle: `${filterSummary} · ${result.rows.length} rows · prepared ${result.at} IST`,
        columns: keys.map((key) => ({ label: label(key) })),
        rows: result.rows.map((row) => keys.map((key) => row[key])),
      },
    ]);
    saveBlob(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${fileBase}.xlsx`,
    );
    toast.success("Excel report downloaded");
  };
  const downloadCsv = () => {
    if (!result?.rows.length || !keys.length) return;
    saveBlob(
      new Blob([reportCsv(result.rows, keys)], { type: "text/csv;charset=utf-8" }),
      `${fileBase}.csv`,
    );
    toast.success("CSV report downloaded");
  };

  return (
    <section className="client-panel ops-report" aria-label="Custom report builder">
      <header className="client-panel-head">
        <div>
          <h2>Build a report</h2>
          <p className="ops-subtle">
            Pick a report, filter it, choose and order columns, then download.
          </p>
        </div>
      </header>
      <div className="ops-preset-grid" role="radiogroup" aria-label="Report type">
        {reportPresets.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={preset === item.id}
            className="ops-preset"
            onClick={() => choosePreset(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </button>
        ))}
      </div>
      <div className="ops-report-filters">
        <label>
          <span>From (initiated)</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => patch({ from: e.target.value })}
          />
        </label>
        <label>
          <span>To</span>
          <input type="date" value={filters.to} onChange={(e) => patch({ to: e.target.value })} />
        </label>
        <label>
          <span>Client</span>
          <select value={filters.clientId} onChange={(e) => patch({ clientId: e.target.value })}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.value} value={client.value}>
                {client.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Responsible RM</span>
          <select value={filters.ownerId} onChange={(e) => patch({ ownerId: e.target.value })}>
            <option value="">Any RM</option>
            {rms.map((rm) => (
              <option key={rm.value} value={rm.value}>
                {rm.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cases</span>
          <select
            value={filters.scope}
            onChange={(e) => patch({ scope: e.target.value as ReportFilters["scope"], stage: "" })}
          >
            <option value="all">All cases</option>
            <option value="active">Active only</option>
            <option value="completed">Completed only</option>
          </select>
        </label>
        <label>
          <span>Stage</span>
          <select
            value={filters.stage}
            disabled={filters.scope === "completed" || preset === "insufficiency"}
            onChange={(e) => patch({ stage: e.target.value })}
          >
            <option value="">All stages</option>
            {opsStageFilters.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="ops-report-actions">
        <ColumnPicker keys={keys} onChange={(next) => setKeys(next)} />
        <span className="ops-subtle">
          {keys.length} columns · up to {REPORT_ROW_LIMIT.toLocaleString("en-IN")} rows
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {busy ? (
            <Button variant="outline" onClick={reset}>
              <X aria-hidden />
              Cancel
            </Button>
          ) : null}
          <Button onClick={() => void prepare()} loading={busy} disabled={!keys.length}>
            <RefreshCw aria-hidden />
            {result ? "Refresh data" : "Prepare report"}
          </Button>
        </div>
      </div>
      <div className="client-queue-feedback" role="status" aria-live="polite">
        {busy
          ? progress
            ? `Reading cases… ${progress.loaded.toLocaleString("en-IN")} of ${progress.total.toLocaleString("en-IN")}`
            : "Reading cases…"
          : ""}
      </div>
      {error ? (
        <p role="alert" className="ops-report-error">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="ops-report-result">
          <div className="ops-report-summary">
            <div>
              <strong>{result.rows.length.toLocaleString("en-IN")} rows ready</strong>
              <span>
                {filterSummary} · prepared {result.at} IST
                {result.truncated
                  ? ` · limited to the first ${REPORT_ROW_LIMIT.toLocaleString("en-IN")} of ${result.total.toLocaleString("en-IN")} cases; narrow the dates for the rest`
                  : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadXlsx} disabled={!result.rows.length || !keys.length}>
                <FileSpreadsheet aria-hidden />
                Download Excel
              </Button>
              <Button
                variant="outline"
                onClick={downloadCsv}
                disabled={!result.rows.length || !keys.length}
              >
                <FileText aria-hidden />
                Download CSV
              </Button>
            </div>
          </div>
          {result.rows.length ? (
            <div
              className="client-table-scroll ops-report-preview"
              role="region"
              aria-label="Report preview"
              tabIndex={0}
            >
              <table className="client-case-table">
                <thead>
                  <tr>
                    {keys.map((key) => (
                      <th key={key} scope="col">
                        {label(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 8).map((row, index) => (
                    <tr key={`${cellText(row.caseNumber)}-${index}`}>
                      {keys.map((key) => {
                        const value = row[key];
                        const tone = value && typeof value === "object" ? value.tone : undefined;
                        return (
                          <td key={key}>
                            {tone ? (
                              <span className={`ops-tone is-${tone}`}>{cellText(value)}</span>
                            ) : (
                              cellText(value)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ops-subtle px-1 py-6 text-center">
              No cases match this report and filters.
            </p>
          )}
          {result.rows.length > 8 ? (
            <p className="ops-subtle mt-2">
              Preview shows 8 of {result.rows.length.toLocaleString("en-IN")} rows. The file
              contains all rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ColumnPicker({
  keys,
  onChange,
}: {
  keys: ReportColumnKey[];
  onChange: (keys: ReportColumnKey[]) => void;
}) {
  const groups = [...new Set(reportColumns.map((column) => column.group))];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Columns3 aria-hidden />
          Customise columns
          <span className="ops-count">{keys.length}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col gap-0 bg-white p-0 sm:max-w-[460px]">
        <SheetHeader className="border-b border-slate-100 px-6 pb-4 pt-6 text-left">
          <SheetTitle>Choose & order columns</SheetTitle>
          <SheetDescription>
            Tick the fields you need. Use the arrows to set their left-to-right order in the file.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <p className="ops-label">Selected order</p>
          <ol className="ops-column-order" aria-label="Selected column order">
            {keys.map((key, index) => (
              <li key={key}>
                <span className="num">{index + 1}</span>
                <span className="flex-1">{label(key)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${label(key)} up`}
                  disabled={index === 0}
                  onClick={() => onChange(moveKey(keys, index, -1))}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Move ${label(key)} down`}
                  disabled={index === keys.length - 1}
                  onClick={() => onChange(moveKey(keys, index, 1))}
                >
                  <ArrowDown aria-hidden />
                </Button>
              </li>
            ))}
          </ol>
          {groups.map((group) => (
            <fieldset key={group} className="ops-column-group">
              <legend>{group}</legend>
              {reportColumns
                .filter((column) => column.group === group)
                .map((column) => (
                  <label key={column.key}>
                    <input
                      type="checkbox"
                      checked={keys.includes(column.key)}
                      onChange={(event) =>
                        onChange(
                          event.target.checked
                            ? [...keys, column.key]
                            : keys.filter((key) => key !== column.key),
                        )
                      }
                    />
                    {column.label}
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
