import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveBlob } from "@/lib/backend-api/client";
import { ClientExportColumns } from "./ClientExportColumns";
import { exportColumns, exportCsv, type ExportKind, type ExportRow } from "./client-export-model";

export function ClientExportPreview({
  kind,
  selected,
  onChange,
  result,
  busy,
}: {
  kind: ExportKind;
  selected: string[];
  onChange: (keys: string[]) => void;
  result?: { rows: ExportRow[]; at: string };
  busy: boolean;
}) {
  const columns = selected.map((key) => exportColumns[kind].find((column) => column.key === key)!);
  return (
    <section
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-label="Custom report preview"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Report preview</h2>
          <p className="mt-1 text-xs text-slate-500">
            {result
              ? `${result.rows.length} matching rows · ${columns.length} columns`
              : "Your selected columns, in the order you choose."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClientExportColumns kind={kind} selected={selected} onChange={onChange} />
          <Button
            className="h-10 rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700"
            disabled={busy || !result?.rows.length || !columns.length}
            onClick={() => {
              if (!result?.rows.length || !columns.length) return;
              saveBlob(
                new Blob([exportCsv(result.rows, columns)], { type: "text/csv;charset=utf-8" }),
                `Sapling-${kind}-${new Date().toISOString().slice(0, 10)}.csv`,
              );
            }}
          >
            <Download aria-hidden />
            Download CSV
          </Button>
        </div>
      </header>
      {columns.length > 0 && (
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Preview table"
        >
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Selected export columns and first ten rows</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                {columns.map((column, index) => (
                  <th
                    scope="col"
                    className="whitespace-nowrap px-5 py-3 font-semibold"
                    key={column.key}
                  >
                    <span className="mr-2 text-[10px] font-medium text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result?.rows.slice(0, 10).map((row, index) => (
                <tr key={index} className="text-slate-700 transition-colors hover:bg-blue-50/40">
                  {columns.map((column) => (
                    <td className="whitespace-nowrap px-5 py-3.5" key={column.key}>
                      {row[column.key] || (row[column.key] === 0 ? 0 : "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(!result?.rows.length || !columns.length) && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-500">
            <FileSpreadsheet aria-hidden className="size-6" />
          </span>
          <h3 className="text-sm font-semibold text-slate-800">
            {!columns.length
              ? "Choose your columns"
              : result
                ? "No matching records"
                : "Your report starts here"}
          </h3>
          <p className="max-w-md text-xs leading-5 text-slate-500">
            {!columns.length
              ? "Open Customise columns and select at least one field."
              : result
                ? "Change your filters and prepare the preview again."
                : "Set the filters above, then apply them to preview your authorised records."}
          </p>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs leading-5 text-slate-500">
        <p role="status">
          {result
            ? `Preview: first 10 rows · Download: all ${result.rows.length} matching rows · Loaded ${result.at}`
            : "No data loaded. Your file will contain only selected columns."}
        </p>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-emerald-700">
          <ShieldCheck aria-hidden className="size-3.5" />
          Authorised records only
        </span>
      </footer>
    </section>
  );
}
