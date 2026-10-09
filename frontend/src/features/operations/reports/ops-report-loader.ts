import { listCases } from "@/lib/backend-api/cases";
import {
  keepForPreset,
  reportQuery,
  reportRow,
  sortForPreset,
  validateReportFilters,
  type ReportFilters,
  type ReportPresetId,
  type ReportRow,
} from "./ops-report-model";

export const REPORT_ROW_LIMIT = 5000;

/** Reads every matching page (100 per request) up to the row limit, reporting progress. */
export async function loadReport(
  preset: ReportPresetId,
  filters: ReportFilters,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ rows: ReportRow[]; total: number; truncated: boolean }> {
  validateReportFilters(filters);
  const rows: ReportRow[] = [];
  let page = 1;
  let read = 0;
  let total = 0;
  const now = Date.now();
  do {
    const result = await listCases(reportQuery(preset, filters, page), signal);
    total = result.total;
    read += result.items.length;
    for (const item of result.items)
      if (keepForPreset(preset, item)) rows.push(reportRow(item, now));
    onProgress(read, total);
    if (!result.items.length) break;
    page += 1;
  } while (read < total && read < REPORT_ROW_LIMIT);
  return { rows: sortForPreset(preset, rows), total, truncated: read < total };
}
