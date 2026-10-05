export type ExportKind = "cases" | "invoices" | "spend";
export type ExportRow = Record<string, string | number>;
export type ExportFilters = { search: string; status: string; from: string; to: string };
export type ExportColumn = { key: string; label: string };
const columns = (pairs: string[][]): ExportColumn[] =>
  pairs.map(([key, label]) => ({ key: key!, label: label! }));
export const exportColumns: Record<ExportKind, ExportColumn[]> = {
  cases: columns([
    ["caseNumber", "Case number"],
    ["candidate", "Candidate"],
    ["status", "Status"],
    ["priority", "Priority"],
    ["package", "Package"],
    ["branch", "Branch"],
    ["checks", "Total checks"],
    ["completed", "Completed checks"],
    ["created", "Created at (IST)"],
    ["updated", "Updated at (IST)"],
    ["due", "Due at (IST)"],
  ]),
  invoices: columns([
    ["invoiceNumber", "Invoice number"],
    ["status", "Status"],
    ["currency", "Currency"],
    ["issued", "Issued at (IST)"],
    ["due", "Due at (IST)"],
    ["billed", "Billed amount"],
    ["paid", "Payments recorded"],
    ["credited", "Credit applied"],
    ["balance", "Outstanding balance"],
  ]),
  spend: columns([
    ["currency", "Currency"],
    ["count", "Invoice count"],
    ["billed", "Total billed"],
    ["paid", "Payments recorded"],
    ["credited", "Credits applied"],
    ["balance", "Outstanding balance"],
  ]),
};
export const defaultColumns: Record<ExportKind, string[]> = {
  cases: ["caseNumber", "candidate", "status", "package", "created"],
  invoices: ["invoiceNumber", "currency", "issued", "billed", "paid", "balance"],
  spend: ["currency", "count", "billed", "paid", "balance"],
};
export function moveColumn(keys: string[], index: number, direction: number) {
  const next = [...keys],
    target = index + direction;
  if (index < 0 || index >= keys.length || target < 0 || target >= keys.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
export function csvCell(value: string | number | undefined) {
  let text = String(value ?? "");
  // Spreadsheet formulas must never execute candidate-controlled text.
  if (typeof value !== "number" && /^[\s\uFEFF]*[=+@-]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function exportCsv(rows: ExportRow[], selected: ExportColumn[]) {
  if (!selected.length || !rows.length)
    throw new Error("Choose columns and load matching records first.");
  return (
    "\uFEFF" +
    [
      selected.map((column) => csvCell(column.label)).join(","),
      ...rows.map((row) => selected.map((column) => csvCell(row[column.key])).join(",")),
    ].join("\r\n")
  );
}
export function validateExportFilters(filters: ExportFilters) {
  for (const value of [filters.from, filters.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        Number.isNaN(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      throw new Error("Enter valid dates.");
    }
  }
  if (filters.from && filters.to && filters.from > filters.to)
    throw new Error("From date must be before or equal to To date.");
}
export function indiaDay(value: string | null | undefined) {
  if (!value) return "";
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 330 * 60_000).toISOString().slice(0, 10) : "";
}
export function inDateRange(value: string | null | undefined, filters: ExportFilters) {
  const day = indiaDay(value);
  if (!filters.from && !filters.to) return true;
  return !!day && (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
}
export function expenseSummary(rows: ExportRow[]): ExportRow[] {
  const groups = new Map<string, ExportRow>();
  for (const row of rows) {
    if (row["status"] === "CANCELLED") continue;
    const currency = String(row["currency"]);
    const group = groups.get(currency) ?? {
      currency,
      count: 0,
      billed: 0,
      paid: 0,
      credited: 0,
      balance: 0,
    };
    group["count"] = Number(group["count"]) + 1;
    for (const key of ["billed", "paid", "credited", "balance"])
      group[key] = Math.round((Number(group[key]) + Number(row[key])) * 100) / 100;
    groups.set(currency, group);
  }
  return [...groups.values()];
}
