import { listCases } from "@/lib/api/cases";
import { casePackageName } from "@/lib/backend-api/case-services";
import { listClientInvoices } from "@/lib/backend-api/client-finance";
import {
  expenseSummary,
  inDateRange,
  validateExportFilters,
  type ExportFilters,
  type ExportKind,
  type ExportRow,
} from "./client-export-model";

const LIMIT = 100;
const MAX_ROWS = 10_000;
function date(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })
    : "";
}
export async function loadClientExport(
  kind: ExportKind,
  filters: ExportFilters,
  signal: AbortSignal,
  progress: (count: number) => void,
): Promise<ExportRow[]> {
  validateExportFilters(filters);
  const rows: ExportRow[] = [],
    ids = new Set<string>(),
    cursors = new Set<string>();
  let cursor: string | undefined, expected: number | undefined;
  for (let page = 1; page <= MAX_ROWS / LIMIT; page++) {
    signal.throwIfAborted();
    let next: string | null | undefined;
    if (kind === "cases") {
      const result = await listCases(
        {
          search: filters.search.trim(),
          status: filters.status,
          page,
          pageSize: LIMIT,
          limit: LIMIT,
          from: filters.from ? filters.from + "T00:00:00+05:30" : undefined,
          to: filters.to ? filters.to + "T23:59:59.999+05:30" : undefined,
          sortBy: "updatedAt",
          sortDir: "asc",
        },
        signal,
      );
      expected ??= result.total;
      if (expected > MAX_ROWS)
        throw new Error("More than 10,000 cases match. Narrow the date, status or search filters.");
      if (result.total !== expected)
        throw new Error("Records changed while preparing. Please refresh the preview.");
      for (const item of result.items) {
        if (ids.has(item.id))
          throw new Error("Records moved during export. Please refresh the preview.");
        ids.add(item.id);
        rows.push({
          caseNumber: item.caseNumber,
          candidate: item.subject.fullName,
          status: item.status,
          priority: item.priority,
          package: casePackageName(item) ?? "",
          branch: item.branch?.name ?? "",
          checks: item.checks.length,
          completed: item.checks.filter((check) => check.status === "COMPLETED").length,
          created: date(item.createdAt),
          updated: date(item.updatedAt),
          due: date(item.dueAt),
        });
      }
      if (ids.size < expected && !result.items.length)
        throw new Error("Incomplete results. Refresh the preview.");
      next = ids.size < expected ? String(page + 1) : null;
    } else {
      const result = await listClientInvoices(
        { search: filters.search.trim(), status: filters.status, cursor, limit: LIMIT },
        signal,
      );
      for (const item of result.items) {
        if (ids.has(item.id))
          throw new Error("Invoices moved during export. Please refresh the preview.");
        ids.add(item.id);
        if (!inDateRange(item.issuedAt, filters)) continue;
        rows.push({
          invoiceNumber: item.invoiceNumber,
          status: item.status,
          currency: item.currency,
          issued: date(item.issuedAt),
          due: date(item.dueAt),
          billed: Number(item.totalAmount),
          paid: Number(item.paidAmount),
          credited: Number(item.creditedAmount),
          balance: item.balance,
        });
      }
      next = result.nextCursor;
      if (next && (!result.items.length || cursors.has(next)))
        throw new Error("Incomplete invoice results. Refresh the preview.");
      if (next) cursors.add(next);
      cursor = next ?? undefined;
    }
    signal.throwIfAborted();
    progress(ids.size);
    if (!next) return kind === "spend" ? expenseSummary(rows) : rows;
  }
  throw new Error(
    "Export exceeds the 10,000 source-record limit. Narrow status or search filters; no partial file was created.",
  );
}
