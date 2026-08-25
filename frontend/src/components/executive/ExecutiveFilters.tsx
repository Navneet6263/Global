import { CalendarClock, Download, FilterX, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import {
  exportExecutiveDashboard,
  type ExecutiveDashboard,
  type ExecutiveDashboardFilters,
} from "@/lib/api/dashboards";

const checkTypes = [
  "IDENTITY",
  "ADDRESS",
  "EMPLOYMENT",
  "EDUCATION",
  "CRIMINAL",
  "COURT_RECORD",
  "REFERENCE",
  "GLOBAL_DATABASE",
  "DRUG_TEST",
];

export function ExecutiveFilters({
  data,
  value,
  onChange,
  onSchedule,
}: {
  data: ExecutiveDashboard | undefined;
  value: ExecutiveDashboardFilters;
  onChange: (value: ExecutiveDashboardFilters) => void;
  onSchedule: () => void;
}) {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const update = (key: keyof ExecutiveDashboardFilters, next: string | number | undefined) =>
    onChange({ ...value, [key]: next || undefined });
  const clear = () => onChange({ months: 6 });
  const download = async (format: "csv" | "pdf") => {
    setExporting(format);
    try {
      await exportExecutiveDashboard(format, value);
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="surface rounded-2xl px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-2 text-[11px] font-bold">
          <SlidersHorizontal className="h-3.5 w-3.5 text-orange-700" /> Portfolio lens
        </span>
        <Select label="Client" value={value.clientId} onChange={(next) => update("clientId", next)}>
          {data?.filters.clients.map((item) => (
            <option key={item.publicId} value={item.publicId}>
              {item.displayName}
            </option>
          ))}
        </Select>
        <Select label="Branch" value={value.branchId} onChange={(next) => update("branchId", next)}>
          {data?.filters.branches.map((item) => (
            <option key={item.publicId} value={item.publicId}>
              {item.name}
            </option>
          ))}
        </Select>
        <Select
          label="Check type"
          value={value.checkType}
          onChange={(next) => update("checkType", next)}
        >
          {checkTypes.map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </Select>
        <Select
          label="Priority"
          value={value.priority}
          onChange={(next) => update("priority", next)}
        >
          {["LOW", "NORMAL", "HIGH", "URGENT"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
        <Select label="Risk" value={value.riskLevel} onChange={(next) => update("riskLevel", next)}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNCLASSIFIED"].map((item) => (
            <option key={item}>{humanize(item)}</option>
          ))}
        </Select>
        <div className="flex h-8 items-center rounded-lg bg-secondary/70 p-1">
          {[3, 6, 12].map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => update("months", months)}
              className={`h-6 rounded-md px-2 text-[9px] font-bold ${value.months === months ? "bg-white shadow-sm" : "text-muted-foreground"}`}
            >
              {months}M
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={clear}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground hover:text-foreground"
          aria-label="Clear all filters"
        >
          <FilterX className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[10px] font-semibold hover:bg-secondary"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule
          </button>
          <button
            type="button"
            onClick={() => void download("csv")}
            disabled={!!exporting || !data}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[10px] font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exporting === "csv" ? "Preparing" : "CSV"}
          </button>
          <button
            type="button"
            onClick={() => void download("pdf")}
            disabled={!!exporting || !data}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-2.5 text-[10px] font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> {exporting === "pdf" ? "Preparing" : "PDF brief"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 min-w-28 cursor-pointer rounded-lg border border-border bg-white px-2.5 text-[10px] font-medium outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      >
        <option value="">All {label.toLowerCase()}s</option>
        {children}
      </select>
    </label>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
