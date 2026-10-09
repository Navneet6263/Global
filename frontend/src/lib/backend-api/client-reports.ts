import { apiDownload, apiRequest, saveBlob } from "./client";
import type { Disposition } from "./rework";

export type MisPreset = "CASE_STATUS" | "TAT" | "UTV" | "DISCREPANCY";
export type MisFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export interface MisResult {
  preset: MisPreset;
  title: string;
  from: string;
  to: string;
  columns: string[];
  total: number;
  colours: Record<string, number>;
  rows: Array<{ cells: string[]; colour: Disposition | null }>;
}

export interface MisSchedule {
  id: string;
  preset: MisPreset;
  frequency: MisFrequency;
  recipients: string[];
  nextRunAt: string;
  lastRunAt: string | null;
  createdAt: string;
}

const rangeQuery = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  return query.toString();
};

export const getMis = (preset: MisPreset, from?: string, to?: string) =>
  apiRequest<MisResult>(`/client-reports/mis?${rangeQuery({ preset, from, to })}`);

export async function downloadMis(preset: MisPreset, from?: string, to?: string) {
  const blob = await apiDownload(`/client-reports/mis/export?${rangeQuery({ preset, from, to })}`);
  saveBlob(blob, `Sapling-Global-${preset.toLowerCase()}-mis.csv`);
}

export async function downloadBulkReports(from?: string, to?: string, colour?: Disposition) {
  const blob = await apiDownload(`/client-reports/bulk?${rangeQuery({ from, to, colour })}`);
  saveBlob(blob, "Sapling-Global-reports.zip");
}

export const getMisSchedules = () =>
  apiRequest<{
    items: MisSchedule[];
    recipients: Array<{ email: string; displayName: string }>;
  }>("/client-reports/schedules");

export const createMisSchedule = (input: {
  preset: MisPreset;
  frequency: MisFrequency;
  recipients: string[];
}) =>
  apiRequest<{ id: string; nextRunAt: string }>("/client-reports/schedules", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteMisSchedule = (id: string) =>
  apiRequest<{ id: string; active: false }>(`/client-reports/schedules/${id}`, {
    method: "DELETE",
  });
