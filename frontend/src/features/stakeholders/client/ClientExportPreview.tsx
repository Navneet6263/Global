import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Button, Card, CardHeader, Row, Td, Th } from "@/kit";
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
    <Card label="Custom report preview" className="min-w-0 overflow-hidden">
      <CardHeader
        title="Report preview"
        description={
          result
            ? `${result.rows.length} matching rows · ${columns.length} columns`
            : "Your selected columns, in the order you choose."
        }
        aside={
          <>
            <ClientExportColumns kind={kind} selected={selected} onChange={onChange} />
            <Button
              variant="primary"
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
          </>
        }
      />
      {columns.length > 0 && (
        <div
          className="max-w-full overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Preview table"
        >
          <table className="w-full border-collapse text-left text-sm text-ink">
            <caption className="sr-only">Selected export columns and first ten rows</caption>
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <Th key={column.key} className="px-4">
                    <span className="mr-2 font-mono text-[10px] font-medium text-dim/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {column.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result?.rows.slice(0, 10).map((row, index) => (
                <Row key={index}>
                  {columns.map((column) => (
                    <Td className="px-4 whitespace-nowrap" key={column.key}>
                      {row[column.key] || (row[column.key] === 0 ? 0 : "—")}
                    </Td>
                  ))}
                </Row>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(!result?.rows.length || !columns.length) && (
        <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="mb-1 grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
            <FileSpreadsheet aria-hidden className="size-5" />
          </span>
          <h3 className="text-sm font-semibold text-ink">
            {!columns.length
              ? "Choose your columns"
              : result
                ? "No matching records"
                : "Your report starts here"}
          </h3>
          <p className="max-w-md text-xs leading-5 text-dim">
            {!columns.length
              ? "Open Customise columns and select at least one field."
              : result
                ? "Change your filters and prepare the preview again."
                : "Set the filters above, then apply them to preview your authorised records."}
          </p>
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle/40 px-4 py-3 text-xs leading-5 text-dim">
        <p role="status">
          {result
            ? `Preview: first 10 rows · Download: all ${result.rows.length} matching rows · Loaded ${result.at}`
            : "No data loaded. Your file will contain only selected columns."}
        </p>
        <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-good">
          <ShieldCheck aria-hidden className="size-3.5" />
          Authorised records only
        </span>
      </footer>
    </Card>
  );
}
