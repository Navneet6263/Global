import { Search } from "lucide-react";
import { Input, Select } from "@/kit";
import { clientStages } from "./client-queue-model";
import type { ExportFilters, ExportKind } from "./client-export-model";

const label = "flex min-w-0 flex-col gap-1 text-xs font-medium text-dim";
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
      className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2 xl:grid-cols-[1.5fr_1.1fr_1fr_1fr]"
      disabled={disabled}
    >
      <legend className="sr-only">Report filters</legend>
      <label className={label}>
        Search
        <span className="relative min-w-0">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
          />
          <Input
            className="pl-9"
            type="search"
            maxLength={120}
            value={value.search}
            placeholder={kind === "cases" ? "Candidate or case number" : "Invoice number"}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
          />
        </span>
      </label>
      <label className={label}>
        Status
        <Select
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </label>
      <label className={label}>
        From date
        <Input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </label>
      <label className={label}>
        To date
        <Input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </label>
    </fieldset>
  );
}
