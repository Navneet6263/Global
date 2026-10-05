import { Search } from "lucide-react";
import { clientStages } from "./client-queue-model";
import type { ExportFilters, ExportKind } from "./client-export-model";

const control =
  "h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60";
export function ClientExportFilters({
  kind,
  value,
  onChange,
  disabled,
}: {
  kind: ExportKind;
  value: ExportFilters;
  onChange: (value: ExportFilters) => void;
  disabled: boolean;
}) {
  const statuses =
    kind === "cases"
      ? clientStages.map((item) => item.value)
      : [
          "ISSUED",
          "PARTIALLY_PAID",
          "PAID",
          "OVERDUE",
          "PARTIALLY_CREDITED",
          "CREDITED",
          "SETTLED",
          "CANCELLED",
        ];
  return (
    <fieldset
      className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.1fr_1fr_1fr]"
      disabled={disabled}
    >
      <legend className="sr-only">Report filters</legend>
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-slate-600">
        Search
        <span className="relative min-w-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400"
          />
          <input
            className={control + " pl-9"}
            type="search"
            maxLength={120}
            value={value.search}
            placeholder={kind === "cases" ? "Candidate or case number" : "Invoice number"}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
          />
        </span>
      </label>
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-slate-600">
        Status
        <select
          className={control}
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-slate-600">
        From date
        <input
          className={control}
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-slate-600">
        To date
        <input
          className={control}
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
    </fieldset>
  );
}
